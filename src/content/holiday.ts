import type { Config, Holiday, Source } from "../types.js";
import { dateAt, validDate } from "../scheduler/planner.js";
export type Query<T> = {
  status: "known" | "none" | "unknown" | "partial";
  data: T;
  coverage: { from: string; to: string; complete: boolean };
  sources: string[];
  freshness: "current" | "stale" | "unknown";
  reason?: string;
  sourceVersion?: string;
  verifiedAt?: string;
};
export function holidayService(
  config: Config,
  sources: Source[] = [],
  now = Date.now(),
) {
  const rawDays = new Map<string, Set<"holiday" | "makeup_workday">>();
  for (const source of sources)
    if (source.data) {
      const raw = JSON.parse(source.data) as {
        days: { date: string; isOffDay: boolean }[];
      };
      for (const day of raw.days) {
        if (!rawDays.has(day.date)) rawDays.set(day.date, new Set());
        rawDays.get(day.date)!.add(day.isOffDay ? "holiday" : "makeup_workday");
      }
    }
  const invalid = new Set<string>();
  const verified = config.holidays.filter((h) => h.verified);
  const verifiedIds = new Set(verified.map((h) => h.id)),
    rawEntries = [...rawDays];
  for (const h of verified) {
    if (
      h.region === "CN" &&
      rawEntries.some(
        ([date, kinds]) =>
          h.start <= date &&
          date <= h.end &&
          kinds.has(h.kind === "holiday" ? "makeup_workday" : "holiday"),
      )
    )
      invalid.add(h.id);
    for (const other of verified)
      if (
        h.region === other.region &&
        h.kind !== other.kind &&
        h.start <= other.end &&
        other.start <= h.end
      ) {
        invalid.add(h.id);
        invalid.add(other.id);
      }
  }
  const rawConflicts = [...rawDays]
    .filter(([, kinds]) => kinds.size > 1)
    .map(([date]) => date);
  function check(region: string, date: string) {
    if (!config.regions.some((r) => r.id === region) || !validDate(date))
      throw new Error("地区或日期错误");
  }
  function complete(region: string, from: string, to: string) {
    if (
      region === "CN" &&
      rawConflicts.some((date) => from <= date && date <= to)
    )
      return false;
    if (
      config.holidays.some(
        (h) =>
          h.region === region &&
          h.start <= to &&
          h.end >= from &&
          (!h.verified || invalid.has(h.id)),
      )
    )
      return false;
    for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++)
      if (
        !config.coverage.some(
          (c) => c.region === region && c.year === y && c.complete,
        )
      )
        return false;
    return true;
  }
  function result<T>(
    region: string,
    from: string,
    to: string,
    data: T,
    hasData: boolean,
    known = complete(region, from, to),
  ): Query<T> {
    const relevant =
      region === "CN"
        ? sources.filter(
            (s) =>
              s.year >= +from.slice(0, 4) - 1 && s.year <= +to.slice(0, 4) + 1,
          )
        : [];
    return {
      status: known
        ? hasData
          ? "known"
          : "none"
        : hasData
          ? "partial"
          : "unknown",
      data,
      coverage: { from, to, complete: known },
      sources: [
        ...new Set(
          config.holidays
            .filter(
              (h) => h.region === region && h.end >= from && h.start <= to,
            )
            .map((h) => h.source),
        ),
      ],
      sourceVersion:
        relevant
          .filter((s) => s.hash)
          .map((s) => `${s.year}:${s.hash}`)
          .join(",") || undefined,
      verifiedAt: config.coverage
        .filter(
          (c) =>
            c.region === region &&
            c.complete &&
            c.year >= +from.slice(0, 4) &&
            c.year <= +to.slice(0, 4),
        )
        .map((c) => c.verifiedAt)
        .sort()
        .at(-1),
      freshness: relevant.some((s) => s.data && s.error)
        ? "stale"
        : relevant.some((s) => !!s.data) || region !== "CN"
          ? "current"
          : "unknown",
      ...(!known ? { reason: "incomplete_coverage" } : {}),
    };
  }
  const sorted = (region: string, from: string, to: string) =>
    config.holidays
      .filter(
        (h) =>
          h.region === region &&
          h.verified &&
          !invalid.has(h.id) &&
          h.kind === "holiday" &&
          h.end >= from &&
          h.start <= to,
      )
      .sort(
        (a, b) =>
          a.start.localeCompare(b.start) ||
          a.end.localeCompare(b.end) ||
          a.id.localeCompare(b.id),
      );
  return {
    isVerified: (id: string) => verifiedIds.has(id) && !invalid.has(id),
    warnings: [
      ...rawConflicts.map((date) => `${date}：年度源的放假/补班记录冲突`),
      ...verified
        .filter((h) => invalid.has(h.id))
        .map((h) => `${h.name}：核验区间与放假/补班数据冲突，暂停相关提醒`),
    ],
    async getNextHoliday(
      region: string,
      from = dateAt(now),
    ): Promise<Query<Holiday | null>> {
      check(region, from);
      const to = `${Math.min(2199, +from.slice(0, 4) + 1)}-12-31`,
        h = sorted(region, from, to)[0] ?? null;
      return result(
        region,
        from,
        h ? (h.start < from ? from : h.start) : to,
        h,
        !!h,
        complete(region, from, h ? (h.start < from ? from : h.start) : to),
      );
    },
    async getRemainingHolidays(
      region: string,
      year: number,
      from = dateAt(now),
    ): Promise<Query<Holiday[]>> {
      check(region, from);
      if (!Number.isInteger(year) || year < 2000 || year > 2199)
        throw new Error("年份错误");
      const start = `${year}-01-01`,
        to = `${year}-12-31`,
        lower = from > start ? from : start;
      const rows = lower > to ? [] : sorted(region, lower, to);
      return result(
        region,
        lower,
        to,
        rows,
        rows.length > 0,
        lower > to || complete(region, lower, to),
      );
    },
    async getDayStatus(
      region: string,
      date: string,
    ): Promise<Query<{ date: string; kind: string; holidayIds: string[] }>> {
      check(region, date);
      const matching = config.holidays.filter(
        (h) =>
          h.region === region && h.verified && h.start <= date && h.end >= date,
      );
      const kinds = new Set(
        matching.map((h) =>
          h.kind === "makeup" ? "makeup_workday" : "holiday",
        ),
      );
      if (region === "CN")
        for (const kind of rawDays.get(date) ?? []) kinds.add(kind);
      const covered = complete(region, date, date),
        conflict = kinds.size > 1;
      const weekday = new Date(date).getUTCDay();
      const kind = conflict
        ? "unknown"
        : kinds.size
          ? [...kinds][0]!
          : !covered
            ? "unknown"
            : region !== "CN"
              ? "unlisted"
              : weekday === 0 || weekday === 6
                ? "weekend"
                : "workday";
      const r = result(
        region,
        date,
        date,
        { date, kind, holidayIds: matching.map((h) => h.id) },
        kind !== "unknown",
        kind !== "unknown",
      );
      if (conflict) r.reason = "conflicting_data";
      return r;
    },
  };
}
