import { it, expect, vi } from "vitest";
import { fixture, start, dueTime, holidayResponse } from "./db.js";
import {
  snapshot,
  saveConfig,
  claim,
  due,
  readData,
} from "../src/data/repository.js";
import {
  exportBackup,
  parseBackup,
  restoreBackup,
} from "../src/data/backup.js";
import { dispatch } from "../src/scheduler/dispatcher.js";
import { syncYear } from "../src/modules/holiday/sync.js";
it("配置与备份只接受当前完整格式，不补齐字段或转换旧数据", async () => {
  const e = await fixture();
  const backup = await exportBackup(e.ctx);
  expect(() => parseBackup({ ...backup, schemaVersion: 2 }, "bot")).toThrow();
  const incomplete = structuredClone(backup);
  Reflect.deleteProperty(incomplete.config.holidayCopy, "reference");
  expect(() => parseBackup(incomplete, "bot")).toThrow();
  expect(incomplete.config.holidayCopy).not.toHaveProperty("reference");
  await e.db.run(
    "UPDATE {state} SET config=? WHERE id=1",
    JSON.stringify({ ...backup.config, schemaVersion: 2 }),
  );
  await expect(snapshot(e.db)).rejects.toThrow("重新安装");
  await expect(readData(e.db)).rejects.toThrow("重新安装");
  await expect(exportBackup(e.ctx)).rejects.toThrow();
});
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
          source: "manual",
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

it("备份恢复按源重建自动假期，仅保留当前和下一年，人工记录保持不变", async () => {
  const e = await fixture();
  const clock = vi.spyOn(Date, "now").mockReturnValue(start);
  try {
    await syncYear(
      e.ctx,
      2026,
      async () => Response.json(holidayResponse(2026)),
      start,
    );
    const b = await exportBackup(e.ctx);
    b.config.holidays = [
      {
        id: "manual",
        name: "人工假期",
        start: "2026-12-01",
        end: "2026-12-02",
        kind: "holiday",
        source: "manual",
      },
      {
        id: "invalid-view",
        name: "陈旧自动视图",
        start: "2028-01-01",
        end: "2028-01-01",
        kind: "holiday",
        source: "uapi",
      },
    ];
    await restoreBackup(e.ctx, b, (await snapshot(e.db)).revision);
    const restored = (await snapshot(e.db)).config.holidays;
    expect(restored.some((h) => h.name === "陈旧自动视图")).toBe(false);
    expect(restored.find((h) => h.id === "manual")).toEqual(
      b.config.holidays[0],
    );
    expect(
      restored.find((h) => h.id === "uapi-holiday-2026-01-01"),
    ).toMatchObject({ end: "2026-01-03" });
  } finally {
    clock.mockRestore();
  }
});
