import type { Config, Holiday, Source } from "../types.js";
import { automaticHolidays } from "../data/calendar.js";
import { activeHolidays } from "../scheduler/events.js";
import { dateAt, validDate } from "../scheduler/planner.js";
export type Query<T> = {
  status: "known" | "none" | "unknown";
  data: T;
  coverage: { from: string; to: string; complete: boolean };
  sources: string[];
  freshness: "current" | "stale" | "unknown";
};
export function holidayService(
  config: Config,
  sources: Source[] = [],
  now = Date.now(),
) {
  const rawDays = new Map<string, "holiday" | "makeup_workday">();
  const publishedYears = new Set<number>();
  for (const source of [...sources].sort((a, b) => a.year - b.year))
    if (source.data) {
      const raw = JSON.parse(source.data) as {
        papers?: string[];
        days: { date: string; isOffDay: boolean }[];
      };
      if (raw.days.length || raw.papers?.length)
        publishedYears.add(source.year);
      for (const day of raw.days)
        rawDays.set(day.date, day.isOffDay ? "holiday" : "makeup_workday");
    }
  // An edited automatic interval also replaces its original raw days.
  const automatic = config.holidays.some((h) => h.manual)
    ? automaticHolidays(sources)
    : [];
  for (const h of config.holidays) {
    const original = h.manual && h.id.match(/^cn-makeup-(\d{4}-\d{2}-\d{2})$/);
    if (original) rawDays.delete(original[1]!);
    const interval = h.manual && automatic.find((item) => item.id === h.id);
    if (interval)
      for (const date of rawDays.keys())
        if (date >= interval.start && date <= interval.end)
          rawDays.delete(date);
  }
  const active = activeHolidays(config);
  const activeIds = new Set(active.map((h) => h.id));
  function check(date: string) {
    if (!validDate(date)) throw new Error("日期错误");
  }
  function complete(from: string, to: string) {
    for (let year = +from.slice(0, 4); year <= +to.slice(0, 4); year++)
      if (!publishedYears.has(year)) return false;
    return true;
  }
  function result<T>(
    from: string,
    to: string,
    data: T,
    hasData: boolean,
  ): Query<T> {
    const covered = complete(from, to),
      relevant = sources.filter(
        (s) => s.year >= +from.slice(0, 4) - 1 && s.year <= +to.slice(0, 4) + 1,
      );
    return {
      status: hasData ? "known" : covered ? "none" : "unknown",
      data,
      coverage: { from, to, complete: covered },
      sources: [
        ...new Set(
          active
            .filter((h) => h.start <= to && h.end >= from)
            .map((h) => h.source),
        ),
      ],
      freshness: relevant.some((s) => s.data && s.error)
        ? "stale"
        : relevant.some((s) => s.data) || hasData
          ? "current"
          : "unknown",
    };
  }
  const sorted = (from: string, to: string) =>
    active
      .filter((h) => h.kind === "holiday" && h.end >= from && h.start <= to)
      .sort(
        (a, b) =>
          a.start.localeCompare(b.start) ||
          a.end.localeCompare(b.end) ||
          a.id.localeCompare(b.id),
      );
  return {
    hasEvent: (id: string) => activeIds.has(id),
    async getNextHoliday(from = dateAt(now)): Promise<Query<Holiday | null>> {
      check(from);
      const to = `${Math.min(2199, +from.slice(0, 4) + 1)}-12-31`,
        h = sorted(from, "2199-12-31")[0] ?? null;
      return result(from, h ? (h.start < from ? from : h.start) : to, h, !!h);
    },
    async getRemainingHolidays(
      year: number,
      from = dateAt(now),
    ): Promise<Query<Holiday[]>> {
      check(from);
      if (!Number.isInteger(year) || year < 2000 || year > 2199)
        throw new Error("年份错误");
      const lower = from > `${year}-01-01` ? from : `${year}-01-01`,
        to = `${year}-12-31`,
        rows = lower > to ? [] : sorted(lower, to);
      return result(lower, to, rows, rows.length > 0);
    },
    async getDayStatus(
      date: string,
    ): Promise<Query<{ date: string; kind: string; holidayIds: string[] }>> {
      check(date);
      const matching = active.filter((h) => h.start <= date && h.end >= date);
      const kinds = new Set(
        matching.map((h) =>
          h.kind === "makeup" ? "makeup_workday" : "holiday",
        ),
      );
      const weekday = new Date(date).getUTCDay();
      const kind =
        kinds.size > 1
          ? "unknown"
          : kinds.size
            ? [...kinds][0]!
            : (rawDays.get(date) ??
              (complete(date, date)
                ? weekday === 0 || weekday === 6
                  ? "weekend"
                  : "workday"
                : "unknown"));
      const out = result(
        date,
        date,
        { date, kind, holidayIds: matching.map((h) => h.id) },
        kind !== "unknown",
      );
      if (kind === "unknown") out.status = "unknown";
      return out;
    },
  };
}
