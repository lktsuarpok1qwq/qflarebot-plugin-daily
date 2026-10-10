import { it, expect, vi } from "vitest";
import { fixture, database, start, dueTime } from "./db.js";
import {
  snapshot,
  saveConfig,
  install,
  claim,
  due,
} from "../src/data/repository.js";
import {
  exportBackup,
  parseBackup,
  restoreBackup,
} from "../src/data/backup.js";
import { dispatch } from "../src/scheduler/dispatcher.js";
import { api } from "../src/admin.js";
import { syncYear } from "../src/data/holiday-cn.js";
const request = (action: string, data?: unknown) =>
  new Request(
    "https://bot.test/p/daily/api/" + action,
    data === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        },
  );
it("备份恢复原启用状态，重复导入不增目标或恢复过期窗口", async () => {
  const e = await fixture(2);
  vi.spyOn(Date, "now").mockReturnValue(dueTime + 5000);
  try {
    const backup = await exportBackup(e.ctx);
    Object.assign(backup.config, {
      holidays: [
        {
          id: "h",
          name: "假期",
          start: "2026-10-10",
          end: "2026-10-12",
          kind: "holiday",
          source: "",
        },
      ],
    });
    expect(parseBackup(backup, "bot")).toBe(backup);
    await restoreBackup(e.ctx, backup, (await snapshot(e.db)).revision);
    await restoreBackup(e.ctx, backup, (await snapshot(e.db)).revision);
    const s = await snapshot(e.db);
    expect(s.config.holidays[0]?.id).toBe("h");
    expect(s.config.recipients).toHaveLength(2);
    expect(s.config.recipients.every((r) => r.enabled)).toBe(true);
    expect((await due(e.db, dueTime + 5000)).length).toBe(0);
    expect(await e.db.all("SELECT due_at FROM {bindings}")).toEqual([
      { due_at: dueTime + 86400000 },
      { due_at: dueTime + 86400000 },
    ]);
  } finally {
    vi.restoreAllMocks();
  }
});
it("跨机器人备份阻止旧OpenID启用", async () => {
  const e = await fixture(),
    b = await exportBackup(e.ctx);
  expect(() => parseBackup({ ...b, botId: "other" }, "bot")).toThrow(
    "其他机器人",
  );
});
it("发送中不能恢复，暂停后仍能收敛旧认领", async () => {
  const e = await fixture();
  await claim(e.db, (await due(e.db, dueTime))[0]!, "sending", dueTime, {});
  const backup = await exportBackup(e.ctx);
  await expect(
    restoreBackup(e.ctx, backup, (await snapshot(e.db)).revision),
  ).rejects.toThrow("发送中");
  const s = await snapshot(e.db),
    c = structuredClone(s.config);
  c.paused = true;
  await saveConfig(e.ctx, s, c, dueTime + 1);
  await dispatch(e.ctx, () => dueTime + 90_000);
  expect(
    (await e.db.first<{ status: string }>("SELECT status FROM {deliveries}"))
      ?.status,
  ).toBe("uncertain");
  expect(e.send).not.toHaveBeenCalled();
});
it("私有管理接口拒绝未认证访问", async () => {
  const e = await fixture();
  const res = await api({
    ctx: e.ctx,
    request: request("state"),
    params: { action: "state" },
    authenticated: false,
  });
  expect(res.status).toBe(401);
});
it("源哈希不变不写，连续相同失败不追加记录", async () => {
  const e = database();
  await install(e.ctx);
  const fetcher = vi.fn(async () =>
    Response.json({
      year: 2026,
      papers: ["https://www.gov.cn/test"],
      days: [],
    }),
  );
  await syncYear(e.ctx, 2026, fetcher);
  const changes = e.metrics.changes;
  await syncYear(e.ctx, 2026, fetcher);
  expect(e.metrics.changes).toBe(changes);
  fetcher.mockImplementation(async () => {
    throw Error("offline");
  });
  await syncYear(e.ctx, 2026, fetcher);
  const failed = e.metrics.changes;
  await syncYear(e.ctx, 2026, fetcher);
  expect(e.metrics.changes).toBe(failed);
  expect(
    (await e.db.first<{ error: string }>("SELECT error FROM {sources}"))?.error,
  ).toBe("offline");
});
it("后台只读取实际游标和来源摘要，不重算五次计划或拉取永久进度", async () => {
  const e = await fixture();
  await e.db.run("UPDATE {bindings} SET due_at=?", dueTime + 12345);
  const raw = JSON.stringify({
    year: 2026,
    papers: [],
    days: [{ date: "2026-10-10", name: "示例", isOffDay: true }],
  });
  await e.db.run(
    "INSERT INTO {sources}(kind,year,hash,data,error,updated_at) VALUES ('official',2026,'hash',?,NULL,0)",
    raw,
  );
  const before = e.metrics.queries;
  const res = await api({
    ctx: e.ctx,
    request: request("state"),
    params: { action: "state" },
    authenticated: true,
  });
  const state = (await res.json()) as {
    cursors: { due_at: number }[];
    sources: { data?: string; hasData: boolean }[];
    plans?: unknown;
  };
  expect(state.cursors[0]!.due_at).toBe(dueTime + 12345);
  expect(state.sources[0]).toMatchObject({ hasData: true });
  expect(state.sources[0]!.data).toBeUndefined();
  expect(state.plans).toBeUndefined();
  expect(e.metrics.queries - before).toBe(4);
});
