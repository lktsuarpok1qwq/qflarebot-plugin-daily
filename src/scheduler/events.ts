import type { Config } from "../types.js";
/** Keep legacy single keys readable. Multiple coincident events share one delivery. */
export function eventKeys(value: string | null): string[] {
  if (!value) return [];
  return value.startsWith("[") ? (JSON.parse(value) as string[]) : [value];
}
export function packEvents(keys: string[]): string | null {
  const unique = [...new Set(keys)].sort();
  return unique.length > 1 ? JSON.stringify(unique) : (unique[0] ?? null);
}

/** Manual entries replace overlapping automatic dates in both queries and plans. */
export function activeHolidays(config: Config) {
  const manual = config.holidays.filter(
    (h) => h.manual || !/^holiday-cn:/.test(h.source),
  );
  const ids = new Set(manual.map((h) => h.id));
  return config.holidays.filter(
    (h) =>
      ids.has(h.id) ||
      !manual.some((m) => m.start <= h.end && h.start <= m.end),
  );
}
