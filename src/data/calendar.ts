import type { Config, Holiday, Source } from "../types.js";
import { dateAt, DAY } from "../scheduler/planner.js";
import type { RawYear } from "./holiday-cn.js";

// An empty upstream placeholder is not an announced annual calendar.
export function hasCalendar(data: string): boolean {
  if (!data) return false;
  const raw = JSON.parse(data) as RawYear;
  return !!(raw.days.length || raw.papers?.length);
}

export function automaticHolidays(sources: Source[]): Holiday[] {
  const days = new Map<string, RawYear["days"][number] & { source: Source }>();
  for (const source of [...sources].sort((a, b) => a.year - b.year)) {
    if (!source.data) continue;
    const raw = JSON.parse(source.data) as RawYear;
    for (const day of raw.days) days.set(day.date, { ...day, source });
  }
  const rows: Holiday[] = [];
  for (const [date, day] of [...days].sort(([a], [b]) => a.localeCompare(b))) {
    const kind = day.isOffDay ? "holiday" : "makeup";
    const previous = rows.at(-1);
    if (
      kind === "holiday" &&
      previous?.kind === kind &&
      previous.name === day.name &&
      Date.parse(date) - Date.parse(previous.end) === DAY
    ) {
      previous.end = date;
      continue;
    }
    rows.push({
      id: `cn-${kind}-${date}`,
      name: day.name,
      start: date,
      end: date,
      kind,
      source: `holiday-cn:${day.source.year}`,
      sourceHash: day.source.hash,
    });
  }
  return rows;
}

export function refreshHolidays(
  config: Config,
  sources: Source[],
  now: number,
) {
  const automatic = config.holidays.filter((h) =>
    /^holiday-cn:\d{4}$/.test(h.source),
  );
  const manual = config.holidays.filter(
    (h) => h.manual || !automatic.includes(h),
  );
  const ids = new Set(manual.map((h) => h.id));
  const rows = [...manual];
  const generated = automaticHolidays(sources);
  const lower = `${dateAt(now).slice(0, 4)}-01-01`;
  // A retained cross-year interval may outlive the previous year's raw file.
  for (const old of automatic)
    if (
      !ids.has(old.id) &&
      old.start < lower &&
      old.end >= lower &&
      !sources.some((s) => old.source === `holiday-cn:${s.year}` && s.data) &&
      !generated.some(
        (h) => h.kind === old.kind && h.start <= old.end && old.start <= h.end,
      )
    )
      rows.push(old);
  for (const h of generated) {
    const old = automatic.find(
      (old) => old.kind === h.kind && old.start === h.start,
    );
    if (old) h.id = old.id;
    if (!ids.has(h.id)) rows.push(h);
  }
  config.holidays = rows
    .filter((h) => h.end >= lower)
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}
