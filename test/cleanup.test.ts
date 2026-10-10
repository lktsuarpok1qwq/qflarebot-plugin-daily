import { expect, it, vi } from "vitest";
import { fixture, start, dueTime, festivalResponse } from "./db.js";
import { boot } from "../src/data/cleanup.js";
import { snapshot, saveConfig, due, claim } from "../src/data/repository.js";
import { syncYear, maintenance } from "../src/data/holiday-cn.js";
import { syncFestivals } from "../src/data/festivals.js";
import { validateConfig } from "../src/data/validation.js";
import { exportBackup, parseBackup } from "../src/data/backup.js";
import { dispatch } from "../src/scheduler/dispatcher.js";

it("云端一次性清理旧表、废弃字段、无效关联和损坏缓存，保留有效配置及永久防重记录", async () => {
  const e = await fixture();
  await syncYear(
    e.ctx,
    2026,
    async () =>
      Response.json({
        year: 2026,
        papers: [],
        days: [{ name: "国庆节", date: "2026-10-01", isOffDay: true }],
      }),
    start,
  );
  await syncFestivals(
    e.ctx,
    2027,
    async () => Response.json(festivalResponse(2027)),
    start,
  );
  const s = await snapshot(e.db);
  const edited = structuredClone(s.config) as unknown as Record<string, any>;
  edited.replies["每日"].body = "**保留我的回复**";
  edited.replies["每日"].format = "markdown";
  edited.replies["每日"].unused = "old";
  edited.replies["每日 下次"] = { body: "旧命令" };
  edited.replies["假期 剩余"].format = "unsupported";
  Object.assign(edited, {
    regions: [],
    coverage: [],
    help: {},
    textLimit: 100,
  });
  edited.tasks[0].schedule.region = "old";
  edited.tasks[0].obsolete = true;
  edited.holidays[0].verified = false;
  edited.bindings[0].oldMode = true;
  edited.contents.push({
    id: "bad",
    name: "旧格式",
    enabled: true,
    kind: "removed",
    body: "old",
  });
  edited.tasks.push({
    ...edited.tasks[0],
    id: "bad-task",
    contentIds: ["bad"],
  });
  edited.bindings.push({ ...edited.bindings[0], taskId: "bad-task" });
  await e.db.run("UPDATE {state} SET config=?", JSON.stringify(edited));
  await e.db.run("UPDATE {sources} SET data='invalid' WHERE kind='official'");
  await e.db.exec(
    "CREATE TABLE {recipient_state}(id TEXT); CREATE TABLE {discovered}(id TEXT)",
  );
  await e.db.run(
    "INSERT INTO {maintenance} VALUES ('sync:0','2026-10-09',NULL)",
  );
  await e.db.run(
    "INSERT INTO {maintenance} VALUES ('sync:official:0','2026-10-10',NULL)",
  );
  await e.db.run(
    "INSERT INTO {event_progress} VALUES ('task:r0','festival-2027-newyear:0')",
  );
  await e.db.run(
    "INSERT INTO {deliveries}(key,task_id,recipient_id,due_at,revision,status,claimed_at,updated_at) VALUES ('history','task','r0',0,1,'success',0,0)",
  );
  await boot(e.ctx, start);
  const c = (await snapshot(e.db)).config;
  expect(validateConfig(c)).toBe(c);
  expect(c.replies["每日"]).toMatchObject({
    body: "**保留我的回复**",
    format: "markdown",
  });
  expect(c.replies["假期 剩余"].format).toBe("plain");
  expect(c).not.toHaveProperty("textLimit");
  expect(c.tasks).toHaveLength(1);
  expect(c.contents).toHaveLength(1);
  expect(c.bindings).toHaveLength(1);
  expect(c.holidays).toHaveLength(0);
  expect(c.festivals).toHaveLength(7);
  expect(await e.db.all("SELECT kind FROM {sources}")).toEqual([
    { kind: "festival" },
  ]);
  await expect(e.db.all("SELECT * FROM {recipient_state}")).rejects.toThrow(
    "no such table",
  );
  await expect(e.db.all("SELECT * FROM {discovered}")).rejects.toThrow(
    "no such table",
  );
  expect(await e.db.all("SELECT event_key FROM {event_progress}")).toEqual([
    { event_key: "festival-2027-newyear:0" },
  ]);
  expect(await e.db.all("SELECT status FROM {deliveries}")).toEqual([
    { status: "success" },
  ]);
  expect(await e.db.all("SELECT job FROM {maintenance} ORDER BY job")).toEqual([
    { job: "sync:official:0" },
    { job: "upgrade:1.5.1" },
  ]);
  const before = { ...e.metrics };
  await boot(e.ctx, start);
  expect(e.metrics.changes).toBe(before.changes);
  expect(e.metrics.queries - before.queries).toBe(1);
  expect((await exportBackup(e.ctx)).config).toEqual(c);
  expect(e.send).not.toHaveBeenCalled();
});

it("清理时保留发送中的认领及进度，重启和旧工作实例收敛后不会重复发送", async () => {
  const e = await fixture();
  const s = await snapshot(e.db),
    c = structuredClone(s.config);
  c.holidays = [
    {
      id: "h",
      name: "提醒",
      start: "2026-10-10",
      end: "2026-10-10",
      kind: "holiday",
      source: "manual",
    },
  ];
  c.tasks[0]!.schedule = {
    kind: "holiday_event",
    eventKind: "holiday",
    time: "09:00",
    offset: 0,
  };
  await saveConfig(e.ctx, s, c, start);
  const pending = (await due(e.db, dueTime))[0]!;
  await claim(e.db, pending, "sending", dueTime, {});
  await boot(e.ctx, dueTime + 1000);
  expect(await e.db.first("SELECT status FROM {deliveries}")).toEqual({
    status: "sending",
  });
  await dispatch(e.ctx, () => dueTime + 90_000);
  expect(await e.db.first("SELECT status FROM {deliveries}")).toEqual({
    status: "uncertain",
  });
  expect(await e.db.all("SELECT event_key FROM {event_progress}")).toEqual([
    { event_key: "h:0" },
  ]);
  expect(e.send).not.toHaveBeenCalled();
});

it("清理中断不写完成标记，可重试；新版入口拒绝旧格式回流", async () => {
  const e = await fixture();
  await e.db.exec("CREATE TABLE {discovered}(id TEXT)");
  const original = e.db.batch.bind(e.db);
  const failure = vi
    .spyOn(e.db, "batch")
    .mockImplementation(async (statements) => {
      if (statements.some((s) => s.sql.startsWith("DROP TABLE")))
        e.failNextBatch();
      return original(statements);
    });
  await expect(boot(e.ctx, start)).rejects.toThrow(
    "simulated transaction failure",
  );
  expect(
    await e.db.first("SELECT job FROM {maintenance} WHERE job='upgrade:1.5.1'"),
  ).toBeNull();
  expect(await e.db.all("SELECT * FROM {discovered}")).toEqual([]);
  failure.mockRestore();
  await boot(e.ctx, start);
  const backup = await exportBackup(e.ctx);
  const old = structuredClone(backup);
  delete (old.config.tasks[0] as Partial<(typeof old.config.tasks)[0]>).format;
  expect(() => parseBackup(old, "bot")).toThrow("格式");
  expect(() => validateConfig({ ...backup.config, textLimit: 500 })).toThrow(
    "不支持的字段",
  );
});

it("升级清理、五个目标发送与一次年度同步共用宿主预算", async () => {
  const e = await fixture(5),
    before = e.metrics.queries;
  vi.stubGlobal("fetch", async () => Response.json(festivalResponse(2026)));
  try {
    await boot(e.ctx, start);
    await dispatch(e.ctx, () => dueTime + 1000);
    await maintenance(e.ctx, "sync", dueTime, false, 0, "festival");
    expect(e.send).toHaveBeenCalledTimes(5);
    expect(e.metrics.queries - before).toBeLessThanOrEqual(40);
  } finally {
    vi.unstubAllGlobals();
  }
});
