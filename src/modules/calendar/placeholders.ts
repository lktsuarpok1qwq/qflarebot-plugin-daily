import type { CalendarConfig, SourceCoverage } from "./types.js";
import { calendarService } from "./service.js";
import { dateAt, DAY } from "../../shared/date.js";
import { createCalendarItem, renderCalendarDocument, renderCalendarQuery } from "./rendering.js";
import { expand } from "../../shared/interpolation.js";
export function calendarValues(config: CalendarConfig, sources: SourceCoverage[], due: number): Record<string, string> {
    const day = dateAt(due), copy = config.calendarCopy;
    let service: ReturnType<typeof calendarService> | undefined;
    const getService = () => service ??= calendarService(config, sources, due);
    let nearest: ReturnType<ReturnType<typeof calendarService>["getNearestEvent"]> | undefined;
    let next: ReturnType<ReturnType<typeof calendarService>["getNextEvent"]> | undefined;
    let today: ReturnType<ReturnType<typeof calendarService>["getDayStatus"]> | undefined;
    const getNearest = () => (nearest ??= getService().getNearestEvent(day)).data;
    const getNext = () => next ??= getService().getNextEvent(day);
    const getToday = () => today ??= getService().getDayStatus(day);
    const raw = (value: string) => expand("{{value}}", { value });
    const range = (key: "start" | "end") => {
        const h = getNearest();
        return h && h.kind !== "reference" && h.kind !== "event" ? h[key] : "";
    };
    const renderToday = (eventsOnly: boolean) => {
        const current = getService(), status = getToday();
        const rows = [...status.data.events, ...(eventsOnly || status.status === "unknown" ? [] : status.data.rows)];
        const item = createCalendarItem(current.events, current.confirmedYears);
        return renderCalendarDocument({ kind: eventsOnly ? "event" : "today", day, items: rows.map((h) => item(h, day, true)) }, copy, expand);
    };
    const getters = {
        "日历.今日节日": () => renderToday(true),
        "日历.今日": () => renderToday(false),
        "日历.今年剩余": () => {
            const current = getService();
            return renderCalendarQuery(current.getRemainingEvents(+day.slice(0, 4), day), "remaining", copy, day, current.events, false, current.confirmedYears);
        },
        "日历.下一个": () => {
            const current = getService();
            return renderCalendarQuery(getNext(), "next", copy, day, current.events, false, current.confirmedYears);
        },
        "日历.节日名称": () => raw(getNearest()?.name ?? ""),
        "日历.下个节日名称": () => raw(getNext().data?.name ?? ""),
        "日历.剩余天数": () => {
            const h = getNearest();
            return h ? String(Math.max(0, Math.round((Date.parse(h.start) - Date.parse(day)) / DAY))) : "";
        },
        "日历.节日日期": () => {
            const h = getNearest();
            return raw(h && (h.kind === "reference" || h.kind === "event") ? h.start : "");
        },
        "日历.开始日期": () => raw(range("start")),
        "日历.结束日期": () => raw(range("end")),
        "日历.天数": () => range("start") ? String(Math.round((Date.parse(range("end")) - Date.parse(range("start"))) / DAY) + 1) : "",
    };
    return Object.defineProperties({}, Object.fromEntries(Object.entries(getters).map(([key, get]) => {
        let value: string | undefined;
        return [key, { enumerable: true, get: () => value ??= get() }];
    })));
}
