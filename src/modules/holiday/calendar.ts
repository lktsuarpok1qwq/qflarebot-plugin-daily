import type { Config, Holiday, Source } from "../../types.js";
import { dateAt, DAY, validDate, addDays } from "../../scheduler/planner.js";
export type CalendarYear = {
  year: number;
  holidays: {
    name: string;
    date: string;
    type: "legal_rest" | "legal_workday_adjust";
  }[];
};
export function validateYear(value: unknown, year: number): CalendarYear {
  const x = value as CalendarYear;
  if (
    !x ||
    x.year !== year ||
    !Array.isArray(x.holidays) ||
    x.holidays.length > 400
  )
    throw new Error("UAPI 年度数据格式错误");
  const days = new Set<string>();
  const holidays = x.holidays
    .map((h) => {
      if (
        !h ||
        typeof h.name !== "string" ||
        !h.name.trim() ||
        h.name.length > 80 ||
        /[\u0000-\u001f]/.test(h.name) ||
        !validDate(h.date) ||
        +h.date.slice(0, 4) !== year ||
        !["legal_rest", "legal_workday_adjust"].includes(h.type) ||
        days.has(h.date)
      )
        throw new Error("UAPI 放假或调休记录非法");
      days.add(h.date);
      return { name: h.name, date: h.date, type: h.type };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  return { year, holidays };
}
export function parseResponse(value: unknown, year: number): CalendarYear {
  const x = value as {
    query?: { year?: string; holiday_type?: string };
    holidays?: unknown;
  };
  if (x?.query?.year !== String(year) || x.query.holiday_type !== "legal")
    throw new Error("UAPI 返回的年度或类别不匹配");
  return validateYear({ year, holidays: x.holidays }, year);
}
export function hasCalendar(data: string): boolean {
  return !!data && (JSON.parse(data) as CalendarYear).holidays.length > 0;
}
export function automaticHolidays(sources: Source[]): Holiday[] {
  const rows: Holiday[] = [];
  for (const source of [...sources].sort((a, b) => a.year - b.year)) {
    if (!source.data) continue;
    for (const d of validateYear(JSON.parse(source.data), source.year)
      .holidays) {
      const kind = d.type === "legal_rest" ? "holiday" : "makeup";
      const previous = rows.at(-1);
      if (
        kind === "holiday" &&
        previous?.kind === kind &&
        previous.name === d.name &&
        Date.parse(d.date) - Date.parse(previous.end) === DAY
      ) {
        previous.end = d.date;
      } else
        rows.push({
          id: `uapi-${kind}-${d.date}`,
          name: d.name,
          start: d.date,
          end: d.date,
          kind,
          source: "uapi",
        });
    }
  }
  return rows;
}
export function activeHolidays(config: Config): Holiday[] {
  const manual = config.holidays.filter(
    (h) => h.manual || h.source === "manual",
  );
  // A manual date overrides that date, without removing the rest of a holiday.
  return config.holidays.flatMap((h) => {
    if (manual.includes(h)) return [h];
    if (manual.some((m) => m.id === h.id)) return [];
    let parts = [h];
    for (const m of manual)
      parts = parts.flatMap((part) => {
        if (m.start > part.end || m.end < part.start) return [part];
        return [
          ...(part.start < m.start
            ? [{ ...part, end: addDays(m.start, -1) }]
            : []),
          ...(part.end > m.end ? [{ ...part, start: addDays(m.end, 1) }] : []),
        ];
      });
    return parts;
  });
}
export function refreshHolidays(
  config: Config,
  sources: Source[],
  now: number,
) {
  const year = +dateAt(now).slice(0, 4);
  const manual = config.holidays.filter((h) => h.manual || h.source !== "uapi");
  const ids = new Set(manual.map((h) => h.id));
  const lower = `${year}-01-01`;
  const automatic = automaticHolidays(sources);
  // Retain the known start of a still-active cross-year break after its old source is removed.
  for (const old of config.holidays.filter(
    (h) =>
      h.source === "uapi" && !h.manual && h.start < lower && h.end >= lower,
  )) {
    const current = automatic.find(
      (h) =>
        h.kind === old.kind &&
        h.name === old.name &&
        h.start <= old.end &&
        h.end >= lower,
    );
    if (current && !sources.some((s) => s.year === +old.start.slice(0, 4))) {
      current.start = old.start;
      current.id = old.id;
    } else if (
      !current &&
      !sources.some((s) => s.year === year && hasCalendar(s.data))
    )
      automatic.push(old);
  }
  config.holidays = [...manual, ...automatic.filter((h) => !ids.has(h.id))]
    .filter((h) => h.end >= lower)
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}
