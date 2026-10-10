import { it, expect, vi, afterEach } from "vitest";
import { database, holidayResponse, start } from "./db.js";
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
afterEach(() => vi.unstubAllGlobals());
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
  expect(state.config).not.toHaveProperty("festivals");
  expect(state.config).not.toHaveProperty("contents");
  expect(state.sources.every((s: any) => s.hasData && !s.data)).toBe(true);
});
it("空年度为未知；本年度无剩余为none；失败或空响应不删除缓存", async () => {
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
  expect((await service.getRemainingEvents(2026)).status).toBe("none");
  const before = data.snapshot.config.holidays;
  await syncYear(
    e.ctx,
    2026,
    async () => new Response(null, { status: 503 }),
    start,
  );
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
  s.config.holidays[0]!.manual = true;
  s.config.holidays[0]!.source = "manual";
  s.config.tasks = [];
  await saveConfig(e.ctx, s, s.config, start);
  raw.holidays.find((h) => h.date === "2026-01-02")!.name = "更新";
  await syncYear(e.ctx, 2026, async () => Response.json(raw), start);
  expect(
    (await snapshot(e.db)).config.holidays.find((h) => h.manual)?.end,
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
