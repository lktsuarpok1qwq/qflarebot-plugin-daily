import type { CalendarConfig, CalendarEvent, SourceCoverage } from "./types.js";
import { activeEvents } from "./events.js";
import { dateAt, validDate } from "../../shared/date.js";
export type Query<T> = {
    status: "known" | "none" | "unknown";
    data: T;
};
export function calendarService(config: CalendarConfig, sources: SourceCoverage[] = [], now = Date.now()) {
    const all = activeEvents(config, +dateAt(now).slice(0, 4)).sort(
        (a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id),
    );
    const holidays = all.filter((h) => h.kind === "holiday"), makeup = all.filter((h) => h.kind === "makeup");
    const conflictIds = new Set<string>();

    for (const holiday of holidays) {
        for (const work of makeup) {
            if (work.start >= holiday.start && work.start <= holiday.end) { conflictIds.add(holiday.id); conflictIds.add(work.id); }
        }
    }

    const conflicts = all.filter((h) => conflictIds.has(h.id)), active = all.filter((h) => !conflictIds.has(h.id));
    const published = new Set(sources.filter((s) => s.is_complete === 1).map((s) => s.year));
    function result<T>(from: string, to: string, data: T, hasData: boolean): Query<T> {
        if (!validDate(from) || !validDate(to)) {
            throw new Error("日期错误");
        }

        let complete = !conflicts.some((h) => h.start <= to && h.end >= from);

        for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) {
            if (!published.has(y)) {
                complete = false;
            }
        }

        return {
            status: hasData ? "known" : complete ? "none" : "unknown",
            data,
        };
    }
    function eventResult(from: string, nearest: boolean): Query<CalendarEvent | null> {
        const end = `${Math.min(2199, +from.slice(0, 4) + 1)}-12-31`;
        let future: CalendarEvent | null = null,
            ongoing: CalendarEvent | null = null;

        for (const event of active) {
            if (event.kind === "makeup") {
                continue;
            }

            if (event.start > from) {
                future = event;
                break;
            }

            if (nearest && event.end >= from && (!ongoing || event.start > ongoing.start)) {
                ongoing = event;
            }
        }

        const h = ongoing ?? future;
        return result(from, h ? (h.start < from ? from : h.start) : end, h, !!h);
    }
    return {
        events: active, conflicts,
        confirmedYears: [...published].filter((year) => !conflicts.some((h) => +h.start.slice(0, 4) <= year && +h.end.slice(0, 4) >= year) && !config.events.some((h) => !h.enabled && h.kind === "makeup" && +h.start.slice(0, 4) === year)),
        getNearestEvent(from = dateAt(now)): Query<CalendarEvent | null> {
            return eventResult(from, true);
        },
        getNextEvent(from = dateAt(now)): Query<CalendarEvent | null> {
            return eventResult(from, false);
        },
        getRemainingEvents(year: number, from = dateAt(now)): Query<CalendarEvent[]> {
            const start = from > `${year}-01-01` ? from : `${year}-01-01`,
                end = `${year}-12-31`;
            const rows = active.filter((h) => h.kind !== "makeup" && h.end >= start && h.start <= end);
            return result(start, end, rows, rows.length > 0);
        },
        getDayStatus(date = dateAt(now)) {
            const rows = active.filter(
                (h) => (h.kind === "holiday" || h.kind === "makeup") && h.start <= date && h.end >= date,
            );
            const conflict = conflicts.some((h) => h.start <= date && h.end >= date);
            const data = {
                kind: conflict ? "unknown" : (rows[0]?.kind ?? "ordinary"),
                names: rows.map((h) => h.name),
                rows, conflict,
                events: active.filter((h) => (h.kind === "event" || h.kind === "reference") && h.start === date),
            };
            const q = result(date, date, data, rows.length > 0);

            if (conflict || (!rows.length && active.some((h) => h.kind === "reference" && h.start === date))) {
                q.status = "unknown";
            }

            return q;
        },
    };
}
