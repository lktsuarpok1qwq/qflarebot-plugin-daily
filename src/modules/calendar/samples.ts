import { addDays } from "../../shared/date.js";
import { calendarValues } from "./placeholders.js";
import { CALENDAR_COPY } from "./copy.js";
import { CALENDAR_VERSION } from "./types.js";
import { createCalendarItem, queryDocument, type CalendarDocument } from "./rendering.js";
import type { CalendarEvent } from "./types.js";

const baseDay = "2026-10-03";
const event = (kind: CalendarEvent["kind"], name: string, start: string, end = start): CalendarEvent => ({ id: name + start, name, start, end, kind, enabled: true, repeat: "once", source: kind === "event" ? "manual" : "uapi" });
const holiday = event("holiday", "示例假期", baseDay, "2026-10-07");
const makeup = event("makeup", holiday.name, "2026-10-10");
const reference = event("reference", "示例节日", "2026-10-09");
const anniversary = event("event", "周年纪念", baseDay);
const holidays = [holiday, makeup];

export function calendarSamples() {
    const cases: { id: string; name: string; events: CalendarEvent[]; day?: string; complete?: boolean }[] = [
        { id: "help", name: "无特殊情景", events: [] },
        { id: "future", name: "尚未开始", day: addDays(baseDay, -2), complete: true, events: holidays },
        { id: "single", name: "单日假期", complete: true, events: [{ ...holiday, end: baseDay }] },
        { id: "first", name: "今天开始", complete: true, events: holidays },
        { id: "during", name: "进行中", day: addDays(baseDay, 2), complete: true, events: holidays },
        { id: "last", name: "今天结束", day: holiday.end, complete: true, events: holidays },
        { id: "reference", name: "节日日期 · 安排待公布", events: [reference] },
        { id: "referenceToday", name: "今日节日 · 安排待公布", day: reference.start, events: [reference] },
        { id: "diy", name: "自定义节日", complete: true, events: [anniversary] },
        { id: "makeup", name: "今日调休", day: makeup.start, complete: true, events: [makeup] },
        { id: "multiple", name: "同日多个事件", complete: true, events: [anniversary, ...holidays] },
        { id: "ordinary", name: "没有剩余节日", complete: true, events: [] },
        { id: "unknown", name: "暂时无法获取信息", events: [] },
        { id: "partial", name: "调休安排待公布", day: addDays(baseDay, -2), events: [holiday] },
    ];

    return cases.map((sample) => {
        const day = sample.day ?? baseDay;
        const confirmed = sample.complete ? [2026] : [];
        const rows = sample.events.filter((h) => h.kind !== "makeup");

        return {
            id: sample.id, name: sample.name,
            get query() {
                return queryDocument({ data: rows, status: rows.length ? "known" : sample.complete ? "none" : "unknown" }, "remaining", day, sample.events, true, confirmed);
            },
            get next() {
                const nextDay = rows.length && !rows.some((h) => h.start > day) ? addDays(rows[0]!.start, -1) : day;
                const future = rows.filter((h) => h.start > nextDay).sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id)).slice(0, 1);

                return queryDocument({ data: future, status: future.length ? "known" : sample.complete ? "none" : "unknown" }, "next", nextDay, sample.events, true, confirmed);
            },
            get reminder(): CalendarDocument {
                const item = createCalendarItem(sample.events, confirmed);

                return { day, kind: "today", items: sample.events.filter((h) => h.start <= day && h.end >= day).map((h) => item(h, day, true)) };
            },
        };
    });
}

export function sampleVariables() {
    return calendarValues({ schemaVersion: CALENDAR_VERSION, calendarCopy: CALENDAR_COPY.text, events: [anniversary, ...holidays, reference] }, [], Date.parse(baseDay + "T09:00:00+08:00"));
}
