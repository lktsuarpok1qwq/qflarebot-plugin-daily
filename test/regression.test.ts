import { it, expect } from "vitest";
import { fixture, start, dueTime } from "./db.js";
import { snapshot, saveConfig, due } from "../src/data/repository.js";
import { dispatch } from "../src/scheduler/dispatcher.js";
import { api } from "../src/admin.js";
import { importHolidays } from "../src/modules/holiday/importer.js";
import { validateConfig } from "../src/data/validation.js";
const invoke = (
  ctx: Awaited<ReturnType<typeof fixture>>["ctx"],
  action: string,
  data: unknown,
) =>
  api({
    ctx,
    params: { action },
    authenticated: true,
    request: new Request("https://test/" + action, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    }),
  });
it("重启后的过期游标成批推进，不饿死新到期任务", async () => {
  const e = await fixture(5),
    before = e.metrics.queries;
  await e.db.run(
    "UPDATE {bindings} SET due_at=due_at-86400000 WHERE recipient_id<>'r0'",
  );
  await dispatch(e.ctx, () => dueTime + 1000);
  expect(e.send).toHaveBeenCalledTimes(5);
  expect(await due(e.db, dueTime + 1000)).toHaveLength(0);
  expect(e.metrics.queries - before).toBeLessThan(30);
});
it("调度遵守每轮上限，超额任务记录跳过", async () => {
  const e = await fixture(6);
  await dispatch(e.ctx, () => dueTime + 1000);
  expect(e.send).toHaveBeenCalledTimes(5);
  expect(
    await e.db.first(
      "SELECT COUNT(*) AS n FROM {deliveries} WHERE status='skipped_budget'",
    ),
  ).toEqual({ n: 1 });
});
it("保存配置时调度已推进的游标不会倒退，即使详细日志已清理", async () => {
  const e = await fixture(),
    s = await snapshot(e.db),
    c = structuredClone(s.config),
    all = e.db.all.bind(e.db);
  let intercept = true;
  e.db.all = async (sql, ...params) => {
    const result = await all(sql, ...params);
    if (intercept && sql.includes("SELECT id,enabled,due_at")) {
      intercept = false;
      await dispatch(e.ctx, () => dueTime + 1000);
      await e.db.run("DELETE FROM {deliveries}");
    }
    return result as never;
  };
  c.replies["每日"].body = "修改帮助";
  await saveConfig(e.ctx, s, c, dueTime + 2000);
  expect(await e.db.first("SELECT due_at FROM {bindings}")).toEqual({
    due_at: dueTime + 86400000,
  });
  await dispatch(e.ctx, () => dueTime + 3000);
  expect(e.send).toHaveBeenCalledTimes(1);
});
it("慢调用跨过39秒预留线时不再开始新请求", async () => {
  const e = await fixture(5);
  let now = dueTime + 1000;
  e.send.mockImplementation(async () => {
    now = dueTime + 40000;
    return { ok: true, status: 200, messageId: "sent", raw: null };
  });
  await dispatch(e.ctx, () => now);
  expect(e.send.mock.calls.length).toBeLessThanOrEqual(2);
  expect(await due(e.db, now)).toHaveLength(0);
});
it("非法CSV、列数、控制字符拒绝；BOM JSON允许", async () => {
  expect(() => importHolidays('name,start\na"b,2026-10-10', [])).toThrow("CSV");
  expect(() => importHolidays("name,start\na,2026-10-10,extra", [])).toThrow(
    "列数",
  );
  expect(
    importHolidays('\uFEFF[{"name":"A","start":"2026-10-10"}]', []).items,
  ).toHaveLength(1);
  const c = (await fixture()).config;
  c.holidays = [
    {
      id: "a",
      name: "bad\x01",
      start: "2026-10-10",
      end: "2026-10-10",
      kind: "holiday",
      source: "manual",
    },
  ];
  expect(() => validateConfig(c)).toThrow();
});
it("JSON结构错误不会发送，修改已有目标身份也被拦截", async () => {
  const e = await fixture();
  expect((await invoke(e.ctx, "config", null)).status).toBe(400);
  expect(e.send).not.toHaveBeenCalled();
  const s = await snapshot(e.db);
  s.config.recipients[0]!.openid = "changed";
  expect(
    (
      await invoke(e.ctx, "config", {
        revision: s.revision,
        config: s.config,
      })
    ).status,
  ).toBe(400);
});
it("无需启用或额外确认即可测试，重复请求仍只发送一次", async () => {
  const e = await fixture(),
    s = await snapshot(e.db);
  s.config.tasks[0]!.enabled = false;
  s.config.recipients[0]!.enabled = false;
  s.config.bindings[0]!.enabled = false;
  await saveConfig(e.ctx, s, s.config, start);
  const data = {
    taskId: "task",
    recipientId: "r0",
    requestId: crypto.randomUUID(),
  };
  expect((await invoke(e.ctx, "preview", data)).status).toBe(200);
  expect(e.send).not.toHaveBeenCalled();
  const cursors = await e.db.all("SELECT * FROM {bindings}");
  const sent = await invoke(e.ctx, "test", data);
  expect(sent.status).toBe(200);
  const result = (await sent.json()) as { text: string };
  expect(result.text).toContain("你好");
  const duplicate = (await (await invoke(e.ctx, "test", data)).json()) as {
    duplicate: boolean;
    text: string;
  };
  expect(duplicate.duplicate).toBe(true);
  expect(duplicate.text).toBe(result.text);
  expect(await e.db.all("SELECT * FROM {bindings}")).toEqual(cursors);
  expect(e.send).toHaveBeenCalledTimes(1);
  expect((await snapshot(e.db)).config.tasks[0]!.enabled).toBe(false);
});
it("认领后暂停取消尚未发起的发送，之后收敛不补发", async () => {
  const e = await fixture(3),
    first = e.db.first.bind(e.db);
  let pause: Promise<unknown> | undefined;
  e.db.first = async (sql, ...params) => {
    if (sql === "SELECT revision FROM {state} WHERE id=1") {
      pause ??= (async () => {
        const s = await snapshot(e.db),
          c = structuredClone(s.config);
        c.paused = true;
        await saveConfig(e.ctx, s, c, dueTime + 1000);
      })();
      await pause;
    }
    return first(sql, ...params) as never;
  };
  await dispatch(e.ctx, () => dueTime + 1000);
  expect(e.send).not.toHaveBeenCalled();
  expect(
    (
      await e.db.all<{ status: string }>("SELECT status FROM {deliveries}")
    ).every((r) => r.status === "skipped_disabled"),
  ).toBe(true);
});
