import type { Config, Plan, Schedule } from "../types.js";
import { packEvents } from "./events.js";
export const DAY = 86_400_000;
export const dateAt = (ms: number) =>
  new Date(ms + 8 * 3_600_000).toISOString().slice(0, 10);
export function validDate(s: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s &&
    +s.slice(0, 4) >= 2000 &&
    +s.slice(0, 4) <= 2199
  );
}
export const at = (date: string, time: string) =>
  Date.parse(`${date}T${time}:00+08:00`);
export const addDays = (date: string, days: number) =>
  new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10);
export function nextPlan(
  s: Schedule,
  after: number,
  config: Config,
  handled: ReadonlySet<string> = new Set(),
): Plan | null {
  if (s.kind === "holiday_event") {
    const candidates = config.holidays
      .filter(
        (h) => h.region === s.region && h.kind === s.eventKind && h.verified,
      )
      .map((h) => ({
        due: at(addDays(h.start, -(s.offset ?? 0)), s.time),
        eventKey: `${h.id}:${s.offset ?? 0}`,
      }))
      .filter((p) => p.due > after && !handled.has(p.eventKey))
      .sort((a, b) => a.due - b.due || a.eventKey.localeCompare(b.eventKey));
    const first = candidates[0];
    return first
      ? {
          due: first.due,
          eventKey: packEvents(
            candidates
              .filter((p) => p.due === first.due)
              .map((p) => p.eventKey),
          ),
        }
      : null;
  }
  if (s.kind === "once") {
    const due = at(s.date!, s.time);
    return due > after ? { due, eventKey: null } : null;
  }
  if (s.kind === "yearly") {
    for (let y = +dateAt(after).slice(0, 4); y <= 2199; y++) {
      const d = `${y}-${s.monthDay}`;
      if (validDate(d) && at(d, s.time) > after)
        return { due: at(d, s.time), eventKey: null };
    }
    return null;
  }
  for (let i = 0; i < 8; i++) {
    const date = addDays(dateAt(after), i),
      due = at(date, s.time),
      weekday = new Date(date).getUTCDay() || 7;
    if (!validDate(date)) return null;
    if (due > after && (s.kind === "daily" || s.weekdays!.includes(weekday)))
      return { due, eventKey: null };
  }
  return null;
}
