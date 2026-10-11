import type { Query } from "./service.js";
import type { CalendarCopy, CalendarEvent } from "./types.js";
import { DAY } from "../../shared/date.js";
import { expand } from "../../shared/interpolation.js";

export function renderCalendarItem(h: CalendarEvent, copy: CalendarCopy, day: string, events: CalendarEvent[]): string {
    const makeup = events
        .filter(
            (m) =>
                m.kind === "makeup" &&
                m.name === h.name &&
                m.start.slice(0, 4) >= h.start.slice(0, 4) &&
                m.start.slice(0, 4) <= h.end.slice(0, 4),
        )
        .map((m) => m.start)
        .join("、");
    const values = {
        name: h.name,
        date: h.start,
        start: h.start,
        end: h.end,
        days_until: String(Math.max(0, Math.round((Date.parse(h.start) - Date.parse(day)) / DAY))),
        days_off: String(Math.round((Date.parse(h.end) - Date.parse(h.start)) / DAY) + 1),
        source: h.source === "uapi" ? "UAPI" : "人工",
        makeup,
    };
    return expand(h.kind === "event" ? copy.event : h.kind === "reference" ? copy.reference : copy.summary, values, {
        ongoing: h.kind === "holiday" && h.start <= day ? copy.ongoing : "",
        ...(makeup ? {} : { makeup: copy.makeupEmpty }),
    });
}

export function withFreshness(text: string, freshness: string, copy: CalendarCopy, day: string) {
    if (!text.trim() || freshness !== "stale" || !copy.stale.trim()) {
        return text;
    }

    const hint = expand(copy.stale, { today: day, year: day.slice(0, 4) });
    return text + (text.endsWith("\n") ? "" : "\n") + hint;
}
export function renderCalendarQuery(
    query: Query<CalendarEvent | CalendarEvent[] | null>,
    kind: "next" | "remaining",
    copy: CalendarCopy,
    day: string,
    events: CalendarEvent[],
    interactive = false,
) {
    let text = "";

    if (query.status === "known") {
        const rows = Array.isArray(query.data) ? query.data : query.data ? [query.data] : [];
        text = rows.map((event) => renderCalendarItem(event, copy, day, events)).join("");
    } else if (interactive) {
        const hint = query.status === "unknown" ? copy.unknown : kind === "remaining" ? copy.noneRemaining : copy.none;
        text = expand(hint, { today: day, year: day.slice(0, 4) });
    }

    if (!text.trim()) {
        if (interactive) {
            throw new Error("日历文案为空");
        }

        return "";
    }

    return withFreshness(text, query.freshness, copy, day);
}
