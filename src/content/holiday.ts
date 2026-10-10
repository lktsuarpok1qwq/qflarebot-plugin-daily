import type { Config, Holiday, Source, Festival } from "../types.js";
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
    if (source.data && source.kind !== "festival") {
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
  const festivals = [...config.festivals].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  const activeIds = new Set([
    ...active.flatMap((h) => [h.id, ...(h.festivalIds ?? [])]),
    ...festivals.map((f) => f.id),
  ]);
  const families = new Map<string, Set<string>>();
  for (const h of active) {
    const family = [h.id, ...(h.festivalIds ?? [])];
    for (const id of family) {
      const related = families.get(id) ?? new Set<string>();
      for (const member of family) related.add(member);
      families.set(id, related);
    }
  }
  const visibleFestivals = festivals.filter(
    (f) =>
      !active.some(
        (h) =>
          h.kind === "holiday" &&
          ((h.festivalIds ?? []).includes(f.id) ||
            (h.start <= f.date && f.date <= h.end)),
      ),
  );
  const events = (from: string, to: string): (Holiday | Festival)[] =>
    [
      ...active.filter(
        (h) => h.kind === "holiday" && h.end >= from && h.start <= to,
      ),
      ...visibleFestivals.filter((f) => f.date >= from && f.date <= to),
    ].sort(
      (a, b) =>
        eventDate(a).localeCompare(eventDate(b)) || a.id.localeCompare(b.id),
    );
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
  return {
    hasEvent: (id: string) => activeIds.has(id),
    pendingEvents(keys: string[], handled: ReadonlySet<string> = new Set()) {
      return keys.filter((key) => {
        const [id, offset] = key.split(":");
        return (
          !handled.has(key) &&
          ![...(families.get(id!) ?? [])].some((member) =>
            handled.has(`${member}:${offset}`),
          )
        );
      });
    },
    async getNextFestival(from = dateAt(now)) {
      check(from);
      return festivals.find((f) => f.date >= from) ?? null;
    },
    async getNextEvent(from = dateAt(now)) {
      check(from);
      const h = events(from, "2199-12-31")[0] ?? null;
      return result(
        from,
        h
          ? eventDate(h) < from
            ? from
            : eventDate(h)
          : `${Math.min(2199, +from.slice(0, 4) + 1)}-12-31`,
        h,
        !!h,
      );
    },
    async getRemainingEvents(year: number, from = dateAt(now)) {
      check(from);
      const rows = events(
        from > `${year}-01-01` ? from : `${year}-01-01`,
        `${year}-12-31`,
      );
      return result(from, `${year}-12-31`, rows, !!rows.length);
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

export const eventDate = (h: Holiday | Festival) =>
  "date" in h ? h.date : h.start;
