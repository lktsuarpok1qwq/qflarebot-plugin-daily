import type { Query } from "./service.js";
import type { CalendarCopy, CalendarEvent } from "./types.js";
import { DAY } from "../../shared/date.js";
import { expand } from "../../shared/interpolation.js";
type CalendarItem = {
    values: Record<string, string>;
    base: "summary" | "today";
    date: "dateRange" | "dateSingle" | "dateReference" | "dateEvent";
    status: "upcoming" | "starts" | "ongoing" | "ends" | "onDay";
    kind: CalendarEvent["kind"];
    makeup: "makeupDates" | "makeupEmpty" | "makeupUnknown" | null;
    today: "todayHolidayText" | "todayMakeupText" | "todayReferenceText" | "todayEventText";
};
export type CalendarDocument = {
    day: string;
    kind: "next" | "remaining" | "today" | "event" | "help";
    items: CalendarItem[];
    empty?: "unknown" | "none" | "noneRemaining";
};
export function createCalendarItem(events: CalendarEvent[], confirmedYears: readonly number[] = []) {
    const dates = new Map<string, Set<string>>();

    for (const event of events) {
        if (event.kind !== "makeup") { continue; }

        let group = dates.get(event.name);

        if (!group) { group = new Set(); dates.set(event.name, group); }

        group.add(event.start);
    }

    const makeupDates = new Map([...dates].map(([name, values]) => [name, [...values].sort()]));
    return (h: CalendarEvent, day: string, reminder = false): CalendarItem => {
        const holiday = h.kind === "holiday", single = h.start === h.end;
        const makeup = (makeupDates.get(h.name) ?? []).filter((date) => date.slice(0, 4) >= h.start.slice(0, 4) && date.slice(0, 4) <= h.end.slice(0, 4)).join("、");
        const confirmed = h.source === "uapi" && confirmedYears.includes(+h.start.slice(0, 4)) && confirmedYears.includes(+h.end.slice(0, 4));
        const phase = h.start > day ? "upcoming" : single ? "onDay" : h.start === day ? "starts" : h.end === day ? "ends" : "ongoing";
        return {
            values: {
                name: h.name, date: single ? h.start : "", start: holiday ? h.start : "", end: holiday ? h.end : "",
                days_until: String(Math.max(0, Math.round((Date.parse(h.start) - Date.parse(day)) / DAY))),
                days_off: holiday ? String(Math.round((Date.parse(h.end) - Date.parse(h.start)) / DAY) + 1) : "",
                source: h.source === "uapi" ? "UAPI" : "人工", makeup, today: day, year: day.slice(0, 4),
            },
            base: reminder ? "today" : "summary", status: phase,
            date: holiday ? (single ? "dateSingle" : "dateRange") : h.kind === "reference" ? "dateReference" : "dateEvent",
            kind: h.kind,
            makeup: holiday || h.kind === "reference" ? (makeup ? "makeupDates" : confirmed && holiday ? "makeupEmpty" : "makeupUnknown") : null,
            today: holiday ? "todayHolidayText" : h.kind === "makeup" ? "todayMakeupText" : h.kind === "reference" ? "todayReferenceText" : "todayEventText",
        };
    };
}
/** Escaped data → generated fragments → shared item template; also executed by the browser sample preview. */
export function renderCalendarDocument(doc: CalendarDocument, copy: CalendarCopy, interpolate: typeof expand, decorate?: (key: keyof CalendarCopy, text: string) => string): string {
    const context = { today: doc.day, year: doc.day.slice(0, 4) };

    if (doc.kind === "help") { const text = interpolate(copy.help, context); return decorate ? decorate("help", text) : text; }

    const rows = doc.items.map((item) => {
        const body = copy[item.base];
        const keys: Record<string, keyof CalendarCopy | null> = item.base === "summary"
            ? { date_text: item.date, status: item.status, makeup_text: item.makeup }
            : { today_text: item.today };
        const fragments = Object.fromEntries(Object.entries(keys).filter(([name]) => body.includes("{{" + name + "}}")).map(([name, key]) => {
            const text = key ? interpolate(copy[key], item.values) : "";
            return [name, key && decorate ? decorate(key, text) : text];
        }));
        const text = interpolate(body, item.values, fragments);
        return decorate ? decorate(item.base, text) : text;
    }).filter((row) => row.trim());

    if (rows.length) { return rows.join(""); }

    const empty = !doc.items.length && doc.empty ? doc.empty : null;
    const text = empty ? interpolate(copy[empty], context) : "";
    return empty && decorate ? decorate(empty, text) : text;
}
export function queryDocument(query: Query<CalendarEvent | CalendarEvent[] | null>, kind: "next" | "remaining", day: string, events: CalendarEvent[], interactive: boolean, confirmedYears: readonly number[]): CalendarDocument {
    const rows = Array.isArray(query.data) ? query.data : query.data ? [query.data] : [];
    const item = createCalendarItem(events, confirmedYears);
    return {
        kind, day, items: rows.map((h) => item(h, day)),
        empty: interactive && !rows.length ? (query.status === "unknown" ? "unknown" : kind === "remaining" ? "noneRemaining" : "none") : undefined,
    };
}
export function renderCalendarQuery(query: Query<CalendarEvent | CalendarEvent[] | null>, kind: "next" | "remaining", copy: CalendarCopy, day: string, events: CalendarEvent[], interactive = false, confirmedYears: readonly number[] = []) {
    const doc = queryDocument(query, kind, day, events, interactive, confirmedYears);
    return renderCalendarDocument(doc, copy, expand);
}
