import type { Config } from "../types.js";
/** Store one event as a key; coincident events share an array and one delivery. */
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
  return config.holidays
    .filter(
      (h) =>
        ids.has(h.id) ||
        !manual.some((m) => m.start <= h.end && h.start <= m.end),
    )
    .map((h) =>
      h.kind !== "holiday" || !ids.has(h.id)
        ? h
        : {
            ...h,
            festivalIds: [
              ...new Set([
                ...(h.festivalIds ?? []),
                ...config.holidays
                  .filter(
                    (original) =>
                      original.kind === "holiday" &&
                      original.start <= h.end &&
                      h.start <= original.end,
                  )
                  .flatMap((original) => original.festivalIds ?? []),
                ...config.festivals
                  .filter((f) => h.start <= f.date && f.date <= h.end)
                  .map((f) => f.id),
              ]),
            ],
          },
    );
}
