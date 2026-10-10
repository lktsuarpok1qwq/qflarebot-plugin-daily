import type { Config, Holiday, Source } from "../../types.js";
import { activeHolidays, hasCalendar } from "./calendar.js";
import { dateAt, validDate } from "../../scheduler/planner.js";
export type Query<T> = {
  status: "known" | "none" | "unknown";
  data: T;
  freshness: "current" | "stale" | "unknown";
};
export function holidayService(
  config: Config,
  sources: Source[] = [],
  now = Date.now(),
) {
  const active = activeHolidays(config).sort((a, b) =>
    a.start.localeCompare(b.start),
  );
  const published = new Set(
    sources.filter((s) => hasCalendar(s.data)).map((s) => s.year),
  );
  function result<T>(
    from: string,
    to: string,
    data: T,
    hasData: boolean,
  ): Query<T> {
    if (!validDate(from) || !validDate(to)) throw new Error("日期错误");
    let complete = true;
    for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++)
      if (!published.has(y)) complete = false;
    const relevant = sources.filter(
      (s) => s.year >= +from.slice(0, 4) && s.year <= +to.slice(0, 4),
    );
    return {
      status: hasData ? "known" : complete ? "none" : "unknown",
      data,
      freshness: relevant.some((s) => s.data && s.error)
        ? "stale"
        : hasData || complete
          ? "current"
          : "unknown",
    };
  }
  return {
    async getNextEvent(from = dateAt(now)): Promise<Query<Holiday | null>> {
      const end = `${Math.min(2199, +from.slice(0, 4) + 1)}-12-31`;
      const h =
        active.find(
          (h) => h.kind === "holiday" && h.end >= from && h.start <= end,
        ) ?? null;
      return result(from, h ? (h.start < from ? from : h.start) : end, h, !!h);
    },
    async getRemainingEvents(
      year: number,
      from = dateAt(now),
    ): Promise<Query<Holiday[]>> {
      const start = from > `${year}-01-01` ? from : `${year}-01-01`,
        end = `${year}-12-31`;
      const rows = active.filter(
        (h) => h.kind === "holiday" && h.end >= start && h.start <= end,
      );
      return result(start, end, rows, rows.length > 0);
    },
    async getDayStatus(date = dateAt(now)) {
      const rows = active.filter((h) => h.start <= date && h.end >= date);
      const conflict = new Set(rows.map((h) => h.kind)).size > 1;
      const data = {
        kind: conflict ? "unknown" : (rows[0]?.kind ?? "ordinary"),
        names: rows.map((h) => h.name),
      };
      const q = result(date, date, data, rows.length > 0);
      if (conflict) q.status = "unknown";
      return q;
    },
  };
}
