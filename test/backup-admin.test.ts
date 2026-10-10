import { it, expect, vi } from "vitest";
import { fixture, database, start, dueTime, holidayResponse } from "./db.js";
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
import { syncYear } from "../src/modules/holiday/sync.js";
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
it("连续相同同步失败不重复写库", async () => {
  const e = database();
  await install(e.ctx);
  const fetcher = vi.fn(async () => Response.json(holidayResponse(2026)));
  await syncYear(e.ctx, 2026, fetcher, start);
  fetcher.mockImplementation(async () => {
    throw Error("offline");
  });
  await syncYear(e.ctx, 2026, fetcher, start);
  const failed = e.metrics.changes;
  await syncYear(e.ctx, 2026, fetcher, start);
  expect(e.metrics.changes).toBe(failed);
  expect(
    (await e.db.first<{ error: string }>("SELECT error FROM {sources}"))?.error,
  ).toBe("offline");
});
