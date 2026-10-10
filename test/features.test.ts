import { it, expect, vi } from "vitest";
import { runCommand } from "@qqbot/sdk/testing";
import { fixture, database, start, dueTime, festivalResponse } from "./db.js";
import {
  install,
  refreshCalendar,
  saveConfig,
  snapshot,
  sources,
  due,
  claim,
  finish,
} from "../src/data/repository.js";
import { syncFestivals, parseFestivalResponse } from "../src/data/festivals.js";
import { syncYear } from "../src/data/holiday-cn.js";
import { exportBackup, restoreBackup } from "../src/data/backup.js";
import { renderCommand, command } from "../src/commands.js";
import { renderMessage } from "../src/content/renderer.js";
import { dispatch } from "../src/scheduler/dispatcher.js";
import { nextPlan } from "../src/scheduler/planner.js";
import { validateConfig } from "../src/data/validation.js";
import plugin from "../src/index.js";

it("新版双来源备份恢复保留格式与防重进度，重启不重写有效配置", async () => {
  const e = await fixture();
  await syncYear(
    e.ctx,
    2027,
    async () =>
      Response.json({
        year: 2027,
        papers: [],
        days: [{ name: "元旦", date: "2027-01-01", isOffDay: true }],
      }),
    start,
  );
  await syncFestivals(
    e.ctx,
    2027,
    async () => Response.json(festivalResponse(2027)),
    start,
  );
  const s = await snapshot(e.db),
    c = structuredClone(s.config);
  c.tasks[0]!.format = "markdown";
  c.bindings[0]!.overrideFormat = "markdown";
  c.bindings[0]!.overrideText = "**覆盖**";
  await saveConfig(e.ctx, s, c, start);
  await e.db.run(
    "INSERT INTO {event_progress} VALUES ('task:r0','festival-2027-newyear:0')",
  );
  const before = await snapshot(e.db),
    queries = e.metrics.queries,
    changes = e.metrics.changes;
  await refreshCalendar(e.ctx, start);
  expect(e.metrics.queries - queries).toBe(2);
  expect(e.metrics.changes).toBe(changes);
  expect(await snapshot(e.db)).toEqual(before);
  expect((await sources(e.db)).map((s) => s.kind).sort()).toEqual([
    "festival",
    "official",
  ]);
  const backup = await exportBackup(e.ctx),
    restored = database();
  await install(restored.ctx);
  await restored.db.run(
    "INSERT INTO {event_progress} VALUES ('task:r0','later:0')",
  );
  await restoreBackup(
    restored.ctx,
    backup,
    (await snapshot(restored.db)).revision,
  );
  const config = (await snapshot(restored.db)).config;
  expect(config.festivals).toHaveLength(7);
  expect(config.bindings[0]).toMatchObject({
    overrideFormat: "markdown",
    overrideText: "**覆盖**",
  });
  expect(config.tasks[0]!.format).toBe("markdown");
  expect((await sources(restored.db)).map((s) => s.kind).sort()).toEqual([
    "festival",
    "official",
  ]);
  expect(
    await restored.db.all(
      "SELECT event_key FROM {event_progress} ORDER BY event_key",
    ),
  ).toEqual([
    { event_key: "festival-2027-newyear:0" },
    { event_key: "later:0" },
  ]);
});

it("日期源仅采用七个节日；失败保留缓存，普通同步不重复抓取，人工修订保留", async () => {
  const e = await fixture();
  const payload = festivalResponse(2027);
  payload.holidays.push({
    name: "春节",
    date: "2027-02-01",
    type: "legal_rest",
  });
  const fetcher = vi.fn(async () =>
    Response.json({ ...payload, extra: "x".repeat(130_000) }),
  );
  await syncFestivals(e.ctx, 2027, fetcher, start);
  const c = (await snapshot(e.db)).config;
  expect(c.festivals).toHaveLength(7);
  expect(c.festivals.find((f) => f.key === "spring")?.date).toBe("2027-02-06");
  const writes = e.metrics.changes;
  await syncFestivals(e.ctx, 2027, fetcher, start + 1000);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(e.metrics.changes).toBe(writes);
  await syncFestivals(
    e.ctx,
    2027,
    async () => {
      throw Error("offline");
    },
    start + 2000,
    true,
  );
  expect((await snapshot(e.db)).config.festivals).toEqual(c.festivals);
  const state = await snapshot(e.db);
  state.config.festivals[0]!.date = "2027-01-02";
  state.config.festivals[0]!.manual = true;
  await saveConfig(e.ctx, await snapshot(e.db), state.config, start + 3000);
  await syncFestivals(e.ctx, 2027, fetcher, start + 4000, true);
  await refreshCalendar(e.ctx, start + 5000);
  expect((await snapshot(e.db)).config.festivals[0]).toMatchObject({
    date: "2027-01-02",
    manual: true,
  });
  expect((await sources(e.db))[0]!.error).toBeNull();
  expect(() =>
    parseFestivalResponse(
      { ...payload, holidays: payload.holidays.slice(1) },
      2027,
    ),
  ).toThrow();
});

it("跨年参考日期无放假区间；正式安排优先、合并节日不重复，模板分支不混用", async () => {
  const e = await fixture();
  await syncFestivals(
    e.ctx,
    2027,
    async () => Response.json(festivalResponse(2027)),
    start,
  );
  let s = await snapshot(e.db);
  const reply = await renderCommand(e.ctx, "假期 下一个", undefined, start);
  expect(reply.text).toContain("2027-01-01（节日日期");
  expect(reply.text).not.toContain(" 至 ");
  s.config.contents[0]!.body =
    "{{holiday.next_name}}开始放假：{{holiday.start_date}}";
  s.config.contents[0]!.referenceBody =
    "{{festival.name}} {{festival.date}}，安排尚未公布";
  expect(
    (
      await renderMessage(
        s.config.tasks[0]!,
        s.config.bindings[0]!,
        s.config,
        start,
      )
    ).text,
  ).toBe("元旦 2027-01-01，安排尚未公布");
  delete s.config.contents[0]!.referenceBody;
  expect(
    (
      await renderMessage(
        s.config.tasks[0]!,
        s.config.bindings[0]!,
        s.config,
        start,
      )
    ).text,
  ).toBe("");
  await syncYear(
    e.ctx,
    2027,
    async () =>
      Response.json({
        year: 2027,
        papers: [],
        days: [
          { name: "元旦", date: "2027-01-01", isOffDay: true },
          { name: "中秋节、国庆节", date: "2027-09-30", isOffDay: true },
        ],
      }),
    start,
  );
  expect(
    (await renderCommand(e.ctx, "假期 下一个", undefined, start)).text,
  ).toContain("2027-01-01 至 2027-01-03");
  const remaining = await renderCommand(
    e.ctx,
    "假期 剩余",
    undefined,
    Date.parse("2027-09-01T00:00:00+08:00"),
  );
  expect(remaining.text).toBe(
    "中秋节、国庆节：2027-09-30 至 2027-09-30\n共 1 天；调休上班日：无",
  );
  // A later UAPI refresh must not put supplemental entries back over arrangements.
  await syncFestivals(
    e.ctx,
    2027,
    async () => Response.json(festivalResponse(2027)),
    start + 1000,
    true,
  );
  expect(
    (
      await renderCommand(
        e.ctx,
        "假期 剩余",
        undefined,
        Date.parse("2027-09-01T00:00:00+08:00"),
      )
    ).text,
  ).toBe(remaining.text);
  s = await snapshot(e.db);
  expect(s.config.festivals).toHaveLength(7); // retained for date-anchored reminders
});

it("节日提醒转正式放假提醒以及更换文案后，同一任务目标节日偏移不再发送", async () => {
  const e = await fixture();
  const before = Date.parse("2026-12-31T08:59:00+08:00"),
    due = before + 60_000;
  await syncFestivals(
    e.ctx,
    2027,
    async () => Response.json(festivalResponse(2027)),
    before,
  );
  let s = await snapshot(e.db);
  s.config.tasks[0]!.schedule = {
    kind: "holiday_event",
    eventKind: "festival",
    offset: 1,
    time: "09:00",
  };
  s.config.contents[0]!.body = "{{festival.name}} {{festival.date}}";
  await saveConfig(e.ctx, await snapshot(e.db), s.config, before);
  await dispatch(e.ctx, () => due + 1000);
  expect(e.send).toHaveBeenCalledTimes(1);
  await syncYear(
    e.ctx,
    2027,
    async () =>
      Response.json({
        year: 2027,
        papers: [],
        days: [{ name: "元旦", date: "2027-01-02", isOffDay: true }],
      }),
    due + 2000,
  );
  s = await snapshot(e.db);
  s.config.tasks[0]!.schedule.eventKind = "holiday";
  s.config.contents[0]!.body = "新的文案";
  await saveConfig(e.ctx, await snapshot(e.db), s.config, due + 3000);
  await dispatch(e.ctx, () => due + 86_400_000 + 1000);
  expect(e.send).toHaveBeenCalledTimes(1);
  expect(
    await e.db.all("SELECT event_key FROM {event_progress}"),
  ).toContainEqual({ event_key: "festival-2027-newyear:1" });
  const plan = nextPlan(
    s.config.tasks[0]!.schedule,
    before,
    s.config,
    new Set(["festival-2027-newyear:1"]),
  );
  expect(plan).toBeNull();
});

it("日期参考认领后中断或发布时仍在发送，正式安排和残留游标都不能绕过去重", async () => {
  const e = await fixture();
  const before = Date.parse("2026-12-31T08:59:00+08:00"),
    instant = before + 60_000;
  await syncFestivals(
    e.ctx,
    2027,
    async () => Response.json(festivalResponse(2027)),
    before,
  );
  let s = await snapshot(e.db);
  s.config.tasks[0]!.schedule = {
    kind: "holiday_event",
    eventKind: "festival",
    offset: 1,
    time: "09:00",
  };
  await saveConfig(e.ctx, await snapshot(e.db), s.config, before);
  const pending = (await due(e.db, instant))[0]!;
  await claim(e.db, pending, "sending", instant, {});
  await syncYear(
    e.ctx,
    2027,
    async () =>
      Response.json({
        year: 2027,
        papers: [],
        days: [{ name: "元旦", date: "2027-01-02", isOffDay: true }],
      }),
    instant + 1000,
  );
  s = await snapshot(e.db);
  s.config.tasks[0]!.schedule.eventKind = "holiday";
  await saveConfig(e.ctx, await snapshot(e.db), s.config, instant + 2000);
  expect(await e.db.first("SELECT due_at FROM {bindings}")).toEqual({
    due_at: null,
  });
  await finish(e.db, pending, "uncertain", instant + 90_000, null);
  // A publisher may have calculated a cursor before the previous send settled.
  await e.db.run(
    "UPDATE {bindings} SET due_at=?,event_key=?",
    instant + 86_400_000,
    JSON.stringify(["cn-holiday-2027-01-02:1", "festival-2027-newyear:1"]),
  );
  await dispatch(e.ctx, () => instant + 86_400_000 + 1000);
  expect(e.send).not.toHaveBeenCalled();
  expect(
    await e.db.all("SELECT status FROM {deliveries} ORDER BY due_at"),
  ).toEqual([{ status: "uncertain" }, { status: "skipped_duplicate" }]);
});

it("群聊私聊 Markdown 与目标纯文本覆盖使用不同缓存，长正文完整发送", async () => {
  const e = await fixture(3),
    s = await snapshot(e.db);
  s.config.tasks[0]!.format = "markdown";
  s.config.contents[0]!.body = "**" + "正文".repeat(600) + "** {{date.today}}";
  s.config.bindings[2]!.overrideText =
    "独立正文 {{date.today}} " + "字".repeat(800);
  s.config.bindings[2]!.overrideFormat = "plain";
  await saveConfig(
    e.ctx,
    await snapshot(e.db),
    validateConfig(s.config),
    start,
  );
  await dispatch(e.ctx, () => dueTime + 1000);
  expect(e.send).toHaveBeenCalledTimes(3);
  const calls = e.send.mock.calls as unknown as [unknown, unknown][];
  expect(calls[0]).toEqual([
    { scene: "group", id: "openid0" },
    { markdown: { content: "**" + "正文".repeat(600) + "** 2026\\-10\\-10" } },
  ]);
  expect(calls[1]![0]).toEqual({ scene: "c2c", id: "openid1" });
  expect(calls[1]![1]).toEqual(calls[0]![1]);
  expect(calls[2]![1]).toEqual({
    text: "独立正文 2026-10-10 " + "字".repeat(800),
  });
  await dispatch(e.ctx, () => dueTime + 2000);
  expect(e.send).toHaveBeenCalledTimes(3);
});

it("六个命令独立配置，空数据、查询失败和平台超限使用对应提示", async () => {
  const e = await fixture(),
    s = await snapshot(e.db);
  const names = Object.keys(
    plugin.commands!,
  ) as (keyof typeof s.config.replies)[];
  expect(names).toEqual([
    "每日",
    "每日 帮助",
    "假期",
    "假期 帮助",
    "假期 下一个",
    "假期 剩余",
  ]);
  for (const name of names)
    Object.assign(s.config.replies[name], {
      format: "markdown",
      body: "**" + name + "**",
      unknown: "未知：" + name,
      error: "失败：" + name,
      tooLong: "超限：" + name,
    });
  await saveConfig(
    e.ctx,
    await snapshot(e.db),
    validateConfig(s.config),
    start,
  );
  for (const name of names) {
    const result = await runCommand(plugin, name, "", {
      ctx: { db: e.db, botId: "bot" },
    });
    expect(result.replies).toHaveLength(1);
    expect(result.replies[0]).toMatchObject({
      markdown: {
        content:
          name.startsWith("假期 ") && name !== "假期 帮助"
            ? "未知：" + name
            : "**" + name + "**",
      },
    });
  }
  const reply = vi.fn(async () => ({
    ok: false,
    code: 40054007,
    error: "too long",
  }));
  const input = { ctx: e.ctx, session: { reply } } as unknown as Parameters<
    typeof command
  >[0];
  expect(await command(input, "每日")).toEqual({
    markdown: { content: "超限：每日" },
  });
  expect(reply).toHaveBeenCalledTimes(1);
  await e.db.run(
    "INSERT INTO {sources}(kind,year,hash,data,error,updated_at) VALUES ('official',2026,'','invalid',NULL,0)",
  );
  expect(await command(input, "假期 下一个")).toEqual({
    markdown: { content: "失败：假期 下一个" },
  });
  const failed = vi
    .spyOn(e.db, "first")
    .mockRejectedValueOnce(Error("db error"));
  // Cached templates cannot be loaded on a complete DB failure: use shipped default.
  expect(await command(input, "每日")).toMatchObject({
    text: expect.stringContaining("失败"),
  });
  failed.mockRestore();
  s.config.replies["假期 下一个"].provisional = "{{start}}";
  expect(() => validateConfig(s.config)).toThrow("未知变量");
});
