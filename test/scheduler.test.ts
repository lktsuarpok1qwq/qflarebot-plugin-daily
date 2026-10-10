import { it, expect } from "vitest";
import { fixture, dueTime, start } from "./db.js";
import { dispatch } from "../src/scheduler/dispatcher.js";
import { claim, due, snapshot, saveConfig } from "../src/data/repository.js";
it("重复空轮询每次只查询一次，零写入、零消息", async () => {
  const e = await fixture();
  const before = { ...e.metrics };
  for (let i = 0; i < 3; i++) await dispatch(e.ctx, () => start);
  expect(e.metrics.queries - before.queries).toBe(3);
  expect(e.metrics.changes - before.changes).toBe(0);
  expect(e.send).not.toHaveBeenCalled();
});
it("并发重复Cron，每个目标只发一次", async () => {
  const e = await fixture(3);
  await Promise.all([
    dispatch(e.ctx, () => dueTime + 5000),
    dispatch(e.ctx, () => dueTime + 5000),
  ]);
  expect(e.send).toHaveBeenCalledTimes(3);
  expect(await e.db.all("SELECT status FROM {deliveries}")).toEqual([
    { status: "success" },
    { status: "success" },
    { status: "success" },
  ]);
  expect((await due(e.db, dueTime + 5000)).length).toBe(0);
});
it("空白消息不发送，逐目标记录跳过", async () => {
  const e = await fixture(2),
    s = await snapshot(e.db);
  s.config.tasks[0]!.body = " \n  ";
  await saveConfig(e.ctx, s, s.config, start + 1000);
  await dispatch(e.ctx, () => dueTime + 1000);
  const logs = await e.db.all<{ status: string; details: string }>(
    "SELECT status,details FROM {deliveries}",
  );
  expect(logs).toHaveLength(2);
  expect(
    logs.every(
      (x) => x.status === "skipped_empty" && JSON.parse(x.details).text === "",
    ),
  ).toBe(true);
  expect(e.send).not.toHaveBeenCalled();
});
it("过期不补发；SDK预留窗口停止新调用", async () => {
  for (const offset of [40_000, 70_000]) {
    const e = await fixture();
    await dispatch(e.ctx, () => dueTime + offset);
    expect(e.send).not.toHaveBeenCalled();
    expect(
      (await e.db.first<{ status: string }>("SELECT status FROM {deliveries}"))
        ?.status,
    ).toBe(offset < 60_000 ? "skipped_budget" : "skipped_expired");
    expect((await due(e.db, dueTime + offset)).length).toBe(0);
  }
});
it("一个目标权限失败不阻塞其他目标，也不封禁下一次计划", async () => {
  const e = await fixture(2);
  e.send.mockImplementationOnce(async () => ({
    ok: false,
    status: 403,
    code: 40034,
    error: "permission",
    raw: null,
  }));
  await dispatch(e.ctx, () => dueTime + 1000);
  expect(e.send).toHaveBeenCalledTimes(2);
  expect(
    await e.db.all("SELECT status FROM {deliveries} ORDER BY recipient_id"),
  ).toEqual([{ status: "failed_api" }, { status: "success" }]);
  await dispatch(e.ctx, () => dueTime + 86400000 + 1000);
  expect(e.send).toHaveBeenCalledTimes(4);
});
it("网络不确定不重试", async () => {
  const e = await fixture();
  e.send.mockRejectedValueOnce(Error("network"));
  await dispatch(e.ctx, () => dueTime + 1000);
  await dispatch(e.ctx, () => dueTime + 2000);
  expect(e.send).toHaveBeenCalledTimes(1);
  expect(
    (await e.db.first<{ status: string }>("SELECT status FROM {deliveries}"))
      ?.status,
  ).toBe("uncertain");
});
it("认领后中断不接管，超时收敛", async () => {
  const e = await fixture(),
    d = (await due(e.db, dueTime))[0]!;
  await claim(e.db, d, "sending", dueTime, {});
  await dispatch(e.ctx, () => dueTime + 1000);
  expect(e.send).not.toHaveBeenCalled();
  await dispatch(e.ctx, () => dueTime + 90_000);
  expect(
    (await e.db.first<{ status: string }>("SELECT status FROM {deliveries}"))
      ?.status,
  ).toBe("uncertain");
  expect((await due(e.db, dueTime + 90_000)).length).toBe(0);
});
it("编辑正文不会为已发送窗口产生新身份", async () => {
  const e = await fixture();
  await dispatch(e.ctx, () => dueTime + 1000);
  const s = await snapshot(e.db);
  s.config.tasks[0]!.body = "修改";
  await saveConfig(e.ctx, s, s.config, dueTime + 2000);
  await dispatch(e.ctx, () => dueTime + 3000);
  expect(e.send).toHaveBeenCalledTimes(1);
});
it("暂停与恢复只排未来计划", async () => {
  const e = await fixture(),
    s = await snapshot(e.db),
    c = structuredClone(s.config);
  c.paused = true;
  await saveConfig(e.ctx, s, c, dueTime + 1000);
  const p = await snapshot(e.db),
    enabled = structuredClone(p.config);
  enabled.paused = false;
  await saveConfig(e.ctx, p, enabled, dueTime + 2000);
  await dispatch(e.ctx, () => dueTime + 3000);
  expect(e.send).not.toHaveBeenCalled();
  expect(
    (await e.db.first<{ due_at: number }>("SELECT due_at FROM {bindings}"))
      ?.due_at,
  ).toBe(dueTime + 86400000);
});
it("D1批事务失败不留下半配置，旧revision写入失败", async () => {
  const e = await fixture(),
    s = await snapshot(e.db),
    c = structuredClone(s.config);
  c.paused = true;
  e.failNextBatch();
  await expect(saveConfig(e.ctx, s, c, start + 1000)).rejects.toThrow();
  expect((await snapshot(e.db)).config.paused).toBe(false);
  await saveConfig(e.ctx, s, c, start + 1000);
  await expect(saveConfig(e.ctx, s, s.config, start + 2000)).rejects.toThrow(
    "配置已变化",
  );
  expect((await snapshot(e.db)).config.paused).toBe(true);
});
it("后台测试中断记录也能收敛，不阻塞恢复", async () => {
  const e = await fixture();
  await e.db.run(
    "INSERT INTO {deliveries}(key,task_id,recipient_id,due_at,revision,status,claimed_at,updated_at) VALUES ('test:interrupted','task','r0',?,2,'sending',?,?)",
    dueTime,
    dueTime,
    dueTime,
  );
  await dispatch(e.ctx, () => dueTime + 90_000);
  expect(
    (
      await e.db.first<{ status: string }>(
        "SELECT status FROM {deliveries} WHERE key='test:interrupted'",
      )
    )?.status,
  ).toBe("uncertain");
});
