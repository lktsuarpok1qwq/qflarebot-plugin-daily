import { it, expect, vi, afterEach } from "vitest";
import { database, holidayResponse, referenceResponse, start } from "./db.js";
import {
  install,
  snapshot,
  readData,
  saveConfig,
} from "../src/data/repository.js";
import { syncYear } from "../src/modules/holiday/sync.js";
import { maintenance } from "../src/data/maintenance.js";
import { holidayService } from "../src/modules/holiday/service.js";
import { parseResponse } from "../src/modules/holiday/calendar.js";
import { renderCommand } from "../src/commands.js";
import { renderMessage } from "../src/content/renderer.js";
import { api } from "../src/admin.js";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("只请求当年明年 legal；页面合并放假和调休，公告与命令跨年一致", async () => {
  const e = database();
  await install(e.ctx);
  const fetcher = vi.fn(async (url: string) =>
    Response.json(
      holidayResponse(Number(new URL(url).searchParams.get("year"))),
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  const result = await maintenance(e.ctx, "sync", start, true);
  expect(result.ok).toBe(true);
  expect(fetcher.mock.calls.map(([url]) => new URL(url).search)).toEqual([
    "?year=2026&holiday_type=legal",
    "?year=2027&holiday_type=legal",
  ]);
  const { snapshot: s, sources } = await readData(e.db);
  expect(s.config.holidays).toHaveLength(4);
  expect(s.config.holidays[0]).toMatchObject({
    start: "2026-01-01",
    end: "2026-01-03",
    kind: "holiday",
    source: "uapi",
  });
  expect(s.config.holidays[1]).toMatchObject({
    start: "2026-01-04",
    end: "2026-01-04",
    kind: "makeup",
  });
  const reply = await renderCommand(
    e.ctx,
    "假期 下一个",
    s.config,
    start,
    sources,
  );
  const announcement = await renderMessage(
    s.config.tasks[0]!,
    { overrideText: null },
    s.config,
    start,
    sources,
  );
  expect(reply.text).toContain("2027\\-01\\-01");
  expect(announcement.text).toContain("2027\\-01\\-01");
  const response = await api({
    ctx: e.ctx,
    authenticated: true,
    params: { action: "state" },
    request: new Request("https://test/state"),
  });
  const state = (await response.json()) as any;
  expect(state.sources).toHaveLength(2);
  expect(state.sources.every((s: any) => s.hasData && !s.data)).toBe(true);
});
it("空年度和未完整公布的年度为未知；失败或空响应不删除缓存", async () => {
  const e = database();
  await install(e.ctx);
  await syncYear(
    e.ctx,
    2026,
    async () => Response.json(holidayResponse(2026)),
    start,
  );
  const empty = () =>
    Response.json({
      query: { year: "2027", holiday_type: "legal" },
      holidays: [],
    });
  await syncYear(e.ctx, 2027, async () => empty(), start);
  let data = await readData(e.db);
  let service = holidayService(data.snapshot.config, data.sources, start);
  expect((await service.getNextEvent()).status).toBe("unknown");
  expect((await service.getRemainingEvents(2026)).status).toBe("unknown");
  const before = data.snapshot.config.holidays;
  await syncYear(
    e.ctx,
    2026,
    async () => new Response(null, { status: 503 }),
    start,
  );
  const failedWrites = e.metrics.changes;
  await syncYear(
    e.ctx,
    2026,
    async () => new Response(null, { status: 503 }),
    start,
  );
  expect(e.metrics.changes).toBe(failedWrites);
  data = await readData(e.db);
  expect(data.snapshot.config.holidays).toEqual(before);
  expect(
    (
      await holidayService(data.snapshot.config, data.sources).getNextEvent(
        "2026-01-01",
      )
    ).freshness,
  ).toBe("stale");
  await syncYear(
    e.ctx,
    2026,
    async () =>
      Response.json({
        query: { year: "2026", holiday_type: "legal" },
        holidays: [],
      }),
    start,
  );
  expect((await snapshot(e.db)).config.holidays).toEqual(before);
  await syncYear(
    e.ctx,
    2026,
    async () => Response.json(holidayResponse(2026)),
    start,
  );
  expect(
    (await readData(e.db)).sources.find((s) => s.year === 2026)?.error,
  ).toBeNull();
});
it("源顺序变化零写入，人工修改同步保留；没有发送任务仍清理过期数据", async () => {
  const e = database();
  await install(e.ctx);
  const raw = holidayResponse(2026);
  await syncYear(e.ctx, 2026, async () => Response.json(raw), start);
  const before = { ...e.metrics };
  raw.holidays.reverse();
  await syncYear(e.ctx, 2026, async () => Response.json(raw), start);
  expect(e.metrics.changes).toBe(before.changes);
  let s = await snapshot(e.db);
  s.config.holidays[0]!.end = "2026-01-05";
  s.config.holidays[0]!.source = "manual";
  s.config.tasks = [];
  await saveConfig(e.ctx, s, s.config, start);
  raw.holidays.find((h) => h.date === "2026-01-02")!.name = "更新";
  await syncYear(e.ctx, 2026, async () => Response.json(raw), start);
  expect(
    (await snapshot(e.db)).config.holidays.find((h) => h.source === "manual")
      ?.end,
  ).toBe("2026-01-05");
  const nextYear = Date.parse("2027-01-01T00:00:00+08:00");
  await maintenance(e.ctx, "cleanup", nextYear);
  expect((await snapshot(e.db)).config.holidays).toEqual([]);
  expect(await e.db.all("SELECT * FROM {sources}")).toEqual([]);
});
it("UAPI返回错误年份、普通节日或冲突日期时拒绝，不推算相邻周末", async () => {
  const raw = holidayResponse(2026);
  expect(() => parseResponse(raw, 2027)).toThrow();
  expect(() =>
    parseResponse(
      {
        ...raw,
        holidays: [
          { date: "2026-01-01", name: "元旦", type: "solar_festival" },
        ],
      },
      2026,
    ),
  ).toThrow();
  expect(() =>
    parseResponse(
      { ...raw, holidays: [raw.holidays[0], raw.holidays[0]] },
      2026,
    ),
  ).toThrow();
  const e = database();
  await install(e.ctx);
  await syncYear(
    e.ctx,
    2026,
    async () =>
      Response.json({
        ...raw,
        holidays: [{ name: "劳动节", date: "2026-05-01", type: "legal_rest" }],
      }),
    start,
  );
  expect((await snapshot(e.db)).config.holidays[0]).toMatchObject({
    start: "2026-05-01",
    end: "2026-05-01",
  });
});
it("人工调休只覆盖当天，跨年假期清除旧年度源后仍保留已知起点", async () => {
  const { activeHolidays, refreshHolidays } =
    await import("../src/modules/holiday/calendar.js");
  const e = database();
  await install(e.ctx);
  const s = await snapshot(e.db);
  s.config.holidays = [
    {
      id: "uapi-holiday-2026-12-31",
      name: "元旦",
      start: "2026-12-31",
      end: "2027-01-03",
      kind: "holiday",
      source: "uapi",
    },
    {
      id: "manual",
      name: "临时调整",
      start: "2027-01-02",
      end: "2027-01-02",
      kind: "makeup",
      source: "manual",
    },
  ];
  const active = activeHolidays(s.config);
  expect(
    active.filter((h) => h.kind === "holiday").map((h) => [h.start, h.end]),
  ).toEqual([
    ["2026-12-31", "2027-01-01"],
    ["2027-01-03", "2027-01-03"],
  ]);
  const raw = holidayResponse(2027);
  refreshHolidays(
    s.config,
    [
      {
        year: 2027,
        hash: "",
        data: JSON.stringify({ year: 2027, holidays: raw.holidays }),
        error: null,
        updated_at: 0,
      },
    ],
    Date.parse("2027-01-01T00:00:00+08:00"),
  );
  expect(
    s.config.holidays.find((h) => h.source === "uapi" && h.kind === "holiday")
      ?.start,
  ).toBe("2026-12-31");
});

it("明年只补充七个节日，查询和公告不虚构放假天数；正式安排覆盖补充且保留人工修改", async () => {
  const e = database();
  await install(e.ctx);
  const raw = referenceResponse();
  const fetcher = vi.fn(async () => Response.json(raw));
  await syncYear(e.ctx, 2027, fetcher, start);
  expect(fetcher).toHaveBeenCalledTimes(1);
  let data = await readData(e.db);
  expect(data.snapshot.config.holidays).toHaveLength(7);
  expect(
    data.snapshot.config.holidays.every((h) => h.kind === "reference"),
  ).toBe(true);
  const { holidayValues } =
    await import("../src/modules/holiday/placeholders.js");
  const values = await holidayValues(data.snapshot.config, data.sources, start);
  expect(values["假期.概览"]).toContain("放假安排待公布");
  expect(values["假期.节日日期"]).toBe("2027\\-01\\-01");
  for (const key of ["假期.开始日期", "假期.结束日期", "假期.天数"])
    expect(values[key]).toBe("");
  const reply = await renderCommand(
    e.ctx,
    "假期 下一个",
    data.snapshot.config,
    start,
    data.sources,
  );
  expect(reply.text).toContain("节日日期");
  expect(reply.text).not.toMatch(/共 .* 天|调休上班日|进行中/);
  expect(
    (
      await holidayService(data.snapshot.config, data.sources).getDayStatus(
        "2027-01-01",
      )
    ).status,
  ).toBe("unknown");
  const labor = data.snapshot.config.holidays.find((h) => h.name === "劳动节")!;
  labor.start = labor.end = "2027-05-02";
  labor.source = "manual";
  await saveConfig(e.ctx, data.snapshot, data.snapshot.config, start);
  raw.holidays = [
    ...holidayResponse(2027).holidays,
    { name: "国庆、中秋节", date: "2027-10-01", type: "legal_rest" },
  ];
  await syncYear(e.ctx, 2027, fetcher, start + 1);
  data = await readData(e.db);
  expect(
    data.snapshot.config.holidays
      .filter((h) => h.kind === "reference")
      .map((h) => h.name),
  ).toEqual(["春节", "清明节", "劳动节", "端午节"]);
  expect(
    data.snapshot.config.holidays.find((h) => h.source === "manual"),
  ).toMatchObject({
    name: "劳动节",
    start: "2027-05-02",
  });
  expect(
    (
      await holidayService(data.snapshot.config, data.sources).getNextEvent(
        "2027-01-01",
      )
    ).data,
  ).toMatchObject({ kind: "holiday", end: "2027-01-03" });
  expect(
    (
      await holidayService(data.snapshot.config, data.sources).getDayStatus(
        "2027-02-06",
      )
    ).status,
  ).toBe("unknown");
  // A same-date manual import is allowed to replace a reference with an actual break.
  const { importHolidays } = await import("../src/modules/holiday/importer.js");
  expect(
    importHolidays(
      '[{"name":"春节","start":"2027-02-06"}]',
      data.snapshot.config.holidays,
    ).items,
  ).toHaveLength(1);
});
it("按北京时间日期每天或每七天检查；手动强制同步；失败次日重试且检查不改数据版本", async () => {
  const e = database();
  await install(e.ctx);
  const at = (day: string) => Date.parse(day + "T00:00:00+08:00");
  let fail = false;
  let next = referenceResponse();
  const fetcher = vi.fn(async (url: string) => {
    if (fail) return new Response(null, { status: 503 });
    const year = +new URL(url).searchParams.get("year")!;
    return Response.json(year === 2026 ? holidayResponse(year) : next);
  });
  vi.stubGlobal("fetch", fetcher);
  await maintenance(e.ctx, "sync", start, true);
  const initial = await readData(e.db);
  await maintenance(e.ctx, "sync", at("2026-10-11"), false, 0);
  expect(fetcher).toHaveBeenCalledTimes(2);
  await maintenance(e.ctx, "sync", at("2026-10-11") + 60_000, false, 1);
  expect(fetcher).toHaveBeenCalledTimes(3);
  const checked = await readData(e.db);
  expect(checked.snapshot.revision).toBe(initial.snapshot.revision);
  expect(checked.sources.find((s) => s.year === 2027)).toMatchObject({
    updated_at: start,
    checked_at: at("2026-10-11") + 60_000,
  });
  // Manual checks bypass the interval; same-day scheduled re-entry stays deduplicated.
  await maintenance(e.ctx, "sync", at("2026-10-11"), true);
  await maintenance(e.ctx, "sync", at("2026-10-11"), false, 0);
  expect(fetcher).toHaveBeenCalledTimes(5);
  next.holidays = next.days.slice(0, 7).map((d) => ({
    name: d.solar_festival ?? d.lunar_festival!,
    date: d.date,
    type: "legal_rest",
  }));
  await maintenance(e.ctx, "sync", at("2026-10-12"), true);
  await maintenance(e.ctx, "sync", at("2026-10-13"), false, 1);
  expect(fetcher).toHaveBeenCalledTimes(7);
  await maintenance(e.ctx, "sync", at("2026-10-18"), false, 0);
  expect(fetcher).toHaveBeenCalledTimes(7);
  fail = true;
  await maintenance(e.ctx, "sync", at("2026-10-19"), false, 0);
  expect(fetcher).toHaveBeenCalledTimes(8);
  const failed = await readData(e.db);
  expect(failed.sources.find((s) => s.year === 2026)?.checked_at).toBe(
    at("2026-10-12"),
  );
  fail = false;
  await maintenance(e.ctx, "sync", at("2026-10-20"), false, 0);
  await maintenance(e.ctx, "sync", at("2026-10-20"), false, 1);
  expect(fetcher).toHaveBeenCalledTimes(10);
  const recovered = await readData(e.db);
  expect(recovered.snapshot).toEqual(failed.snapshot);
  expect(recovered.sources.find((s) => s.year === 2026)).toMatchObject({
    error: null,
    updated_at: start,
    checked_at: at("2026-10-20"),
  });
  expect(await e.db.all("SELECT * FROM {deliveries}")).toEqual([]);
});
it("零点维护按北京时间跨年；补充日期跨年保留，旧年度源和检查信息清除", async () => {
  const e = database();
  await install(e.ctx);
  await syncYear(
    e.ctx,
    2026,
    async () => Response.json(holidayResponse(2026)),
    start,
  );
  await syncYear(
    e.ctx,
    2027,
    async () => Response.json(referenceResponse()),
    start,
  );
  const plugin = (await import("../src/index.js")).default;
  const fetcher = vi.fn(async (url: string) =>
    Response.json(referenceResponse(+new URL(url).searchParams.get("year")!)),
  );
  vi.stubGlobal("fetch", fetcher);
  const midnight = Date.parse("2026-12-31T16:00:00Z");
  expect(plugin.cron!.sync!.cron).toBe("0,1 16 * * *");
  expect(plugin.cron!.cleanup!.cron).toBe("10 16 * * *");
  await plugin.cron!.sync!.handler({
    ctx: e.ctx,
    scheduledAt: midnight,
  } as any);
  await plugin.cron!.sync!.handler({
    ctx: e.ctx,
    scheduledAt: midnight + 60_000,
  } as any);
  expect(
    fetcher.mock.calls.map(([url]) => new URL(url).searchParams.get("year")),
  ).toEqual(["2027", "2028"]);
  await plugin.cron!.cleanup!.handler({
    ctx: e.ctx,
    scheduledAt: midnight + 600_000,
  } as any);
  let data = await readData(e.db);
  expect(data.sources.map((s) => s.year)).toEqual([2027, 2028]);
  expect(data.snapshot.config.holidays).toHaveLength(14);
  expect(
    await e.db.first("SELECT * FROM {maintenance} WHERE job='holiday:2026'"),
  ).toBeNull();
  // Receiving official data for the now-current year replaces only matching references.
  await syncYear(
    e.ctx,
    2027,
    async () => Response.json(holidayResponse(2027)),
    midnight + 86_400_000,
  );
  data = await readData(e.db);
  expect(
    data.snapshot.config.holidays.find(
      (h) => h.name === "元旦" && h.start === "2027-01-01",
    )?.kind,
  ).toBe("holiday");
  expect(
    data.snapshot.config.holidays.filter(
      (h) => h.start.startsWith("2027") && h.kind === "reference",
    ),
  ).toHaveLength(6);
});

it("恢复默认解除单条人工覆盖，采用最新缓存并继续跟随更新；没有缓存不删除人工记录", async () => {
  vi.spyOn(Date, "now").mockReturnValue(start);
  const e = database();
  await install(e.ctx);
  const raw = referenceResponse();
  const fetcher = vi.fn(async () => Response.json(raw));
  await syncYear(e.ctx, 2027, fetcher, start);
  let s = await snapshot(e.db);
  const original = s.config.holidays.find((h) => h.name === "元旦")!;
  const id = original.id;
  Object.assign(original, {
    name: "改过名称的元旦",
    start: "2027-01-02",
    end: "2027-01-02",
    source: "manual",
  });
  const unrelated = {
    id: "personal",
    name: "个人假期",
    start: "2027-08-01",
    end: "2027-08-01",
    kind: "holiday" as const,
    source: "manual" as const,
  };
  s.config.holidays.push(unrelated);
  await saveConfig(e.ctx, s, s.config, start);
  // Official data arrives while the reference has been manually edited.
  raw.holidays = holidayResponse(2027).holidays;
  await syncYear(e.ctx, 2027, fetcher, start + 1);
  s = await snapshot(e.db);
  const reset = (target: string, revision = s.revision) =>
    api({
      ctx: e.ctx,
      authenticated: true,
      params: { action: "holiday-reset" },
      request: new Request("https://test/holiday-reset", {
        method: "POST",
        body: JSON.stringify({ id: target, revision }),
      }),
    });
  expect((await reset(id, s.revision - 1)).status).toBe(400);
  expect((await reset("personal")).status).toBe(400);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw Error("恢复不应请求接口");
    }),
  );
  expect((await reset(id)).status).toBe(200);
  s = await snapshot(e.db);
  expect(s.config.holidays.find((h) => h.id === id)).toBeUndefined();
  expect(s.config.holidays.filter((h) => h.name === "元旦")).toHaveLength(2); // break + makeup
  expect(s.config.holidays.find((h) => h.kind === "holiday")).toMatchObject({
    source: "uapi",
    start: "2027-01-01",
    end: "2027-01-03",
  });
  expect(s.config.holidays.find((h) => h.id === "personal")).toEqual(unrelated);
  // Reset a manually changed break even when UAPI has moved its start (and ID).
  const breakId = s.config.holidays.find((h) => h.kind === "holiday")!.id;
  Object.assign(
    s.config.holidays.find((h) => h.id === breakId)!,
    { source: "manual", end: "2027-01-05" },
  );
  await saveConfig(e.ctx, s, s.config, start);
  raw.holidays.shift();
  await syncYear(e.ctx, 2027, fetcher, start + 2);
  s = await snapshot(e.db);
  expect((await reset(breakId)).status).toBe(200);
  s = await snapshot(e.db);
  expect(s.config.holidays.find((h) => h.id === breakId)).toBeUndefined();
  raw.holidays.find((h) => h.date === "2027-01-04")!.type = "legal_rest";
  await syncYear(e.ctx, 2027, fetcher, start + 3);
  s = await snapshot(e.db);
  expect(s.config.holidays.find((h) => h.name === "元旦")).toMatchObject({
    source: "uapi",
    start: "2027-01-02",
    end: "2027-01-04",
  });
  const labor = s.config.holidays.find((h) => h.name === "劳动节")!;
  Object.assign(labor, { source: "manual" });
  await saveConfig(e.ctx, s, s.config, start);
  await e.db.run("DELETE FROM {sources}");
  s = await snapshot(e.db);
  expect((await reset(labor.id)).status).toBe(400);
  expect(await snapshot(e.db)).toEqual(s);
  expect(fetch).not.toHaveBeenCalled();
});

it("不完整响应保留缺失节日，完整年度才判定没有剩余，错误消失后恢复正常频率", async () => {
  const e = database();
  await install(e.ctx);
  const { FESTIVALS, refreshDays } =
    await import("../src/modules/holiday/calendar.js");
  const raw = referenceResponse(2026);
  raw.holidays = raw.days
    .slice(0, 7)
    .map((d, i) => ({ name: FESTIVALS[i]!, date: d.date, type: "legal_rest" }));
  const complete = structuredClone(raw);
  await syncYear(e.ctx, 2026, async () => Response.json(raw), start);
  let data = await readData(e.db);
  expect(
    (
      await holidayService(
        data.snapshot.config,
        data.sources,
        start,
      ).getRemainingEvents(2026)
    ).status,
  ).toBe("none");
  const unchanged = data.snapshot;
  raw.holidays = [raw.holidays[0]!];
  expect(
    (await syncYear(e.ctx, 2026, async () => Response.json(raw), start + 1))
      .status,
  ).toBe("error");
  data = await readData(e.db);
  expect(data.snapshot).toEqual(unchanged);
  expect(data.sources[0]!.error).toContain("不完整");
  const reply = await renderCommand(
    e.ctx,
    "假期 剩余",
    data.snapshot.config,
    start,
    data.sources,
  );
  expect(reply.text).toContain("最近可信版本");
  const fetcher = vi.fn(async () => Response.json(complete));
  await syncYear(e.ctx, 2026, fetcher, start + 86400000, false);
  expect(fetcher).toHaveBeenCalledTimes(1);
  data = await readData(e.db);
  expect(data.sources[0]!.error).toBeNull();
  expect(refreshDays(data.sources[0]!.data, false)).toBe(7);
  expect(data.snapshot).toEqual(unchanged);
});
it("恢复默认不复活其他删除项，跨年源已清理后仍可恢复元旦", async () => {
  const { restoreHoliday } = await import("../src/modules/holiday/calendar.js");
  const e = database();
  await install(e.ctx);
  await syncYear(
    e.ctx,
    2027,
    async () => Response.json(referenceResponse()),
    start,
  );
  const data = await readData(e.db),
    c = data.snapshot.config;
  const target = c.holidays.find((h) => h.name === "元旦")!;
  Object.assign(target, { name: "改名", source: "manual" });
  c.holidays = c.holidays.filter((h) => h.name !== "劳动节");
  restoreHoliday(c, data.sources, target.id, start);
  expect(c.holidays.some((h) => h.name === "劳动节")).toBe(false);
  expect(c.holidays.find((h) => h.id === target.id)).toMatchObject({
    name: "元旦",
    source: "uapi",
  });
  c.holidays = [
    {
      id: "uapi-holiday-2026-12-31",
      name: "改名后的跨年假期",
      start: "2026-12-31",
      end: "2027-01-05",
      kind: "holiday",
      source: "manual",
    },
  ];
  restoreHoliday(
    c,
    [
      {
        year: 2027,
        hash: "",
        data: JSON.stringify({
          year: 2027,
          holidays: holidayResponse(2027).holidays,
        }),
        error: null,
        updated_at: start,
      },
    ],
    c.holidays[0]!.id,
    Date.parse("2027-01-01T00:00:00+08:00"),
  );
  expect(c.holidays).toHaveLength(1);
  expect(c.holidays[0]).toMatchObject({
    name: "元旦",
    source: "uapi",
    start: "2027-01-01",
    end: "2027-01-03",
  });
});
