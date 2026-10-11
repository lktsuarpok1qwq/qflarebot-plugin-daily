import type { Config, CalendarEvent, Source, CommandName, Rendered } from "../../types.js";
import { calendarService } from "./service.js";
import { activeEvents } from "./calendar.js";
import { dateAt, DAY } from "../../scheduler/planner.js";
import { expand } from "../../content/interpolation.js";
export async function renderCalendarReply(
    config: Config,
    raw: Source[],
    name: CommandName,
    now: number,
): Promise<Rendered> {
    const day = dateAt(now),
        reply = config.replies[name],
        values = { today: day, year: day.slice(0, 4) };
    const service = calendarService(config, raw, now);
    const q =
        name === "假期 下一个"
            ? await service.getNextEvent(day)
            : await service.getRemainingEvents(+day.slice(0, 4), day);

    if (q.status !== "known") {
        return {
            text:
                expand(q.status === "none" ? reply.empty : reply.unknown, values) +
                (q.freshness === "stale" ? expand(reply.stale, values) : ""),
        };
    }

    const rows: CalendarEvent[] = Array.isArray(q.data) ? q.data : q.data ? [q.data] : [];
    const holidays = activeEvents(config, +day.slice(0, 4));
    const lines = rows.map((h) => {
        const date = h.start;
        const vars = {
            ...values,
            name: h.name,
            date: h.start,
            start: h.start,
            end: h.end,
            days_until: String(Math.max(0, Math.round((Date.parse(date) - Date.parse(day)) / DAY))),
            days_off: String(Math.round((Date.parse(h.end) - Date.parse(h.start)) / DAY) + 1),
            makeup: holidays
                .filter(
                    (m) =>
                        m.kind === "makeup" &&
                        m.name === h.name &&
                        m.start.slice(0, 4) >= h.start.slice(0, 4) &&
                        m.start.slice(0, 4) <= h.end.slice(0, 4),
                )
                .map((m) => m.start)
                .join("、"),
            source: h.source === "uapi" ? "UAPI" : "人工",
            ongoing: "",
        };

        if (h.kind === "event") {
            return expand(reply.event, vars);
        }

        if (h.kind === "reference") {
            return expand(reply.reference, vars);
        }

        const ongoing = h.start <= day ? expand(reply.ongoing, vars) : "";
        return expand(reply.item, vars, {
            ongoing,
            ...(vars.makeup ? {} : { makeup: expand(reply.makeupEmpty, values) }),
        });
    });
    const fragments: Record<string, string> = {
        items: lines.join(""),
        stale: q.freshness === "stale" ? expand(reply.stale, values) : "",
    };
    const text = expand(reply.body, { ...values, count: String(rows.length) }, fragments);
    return { text };
}
