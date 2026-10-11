import type { CalendarConfig, Source } from "./types.js";
import { calendarService } from "./service.js";
import { dateAt, DAY } from "../../shared/date.js";
import { renderCalendarQuery, withFreshness } from "./rendering.js";
import { expand } from "../../shared/interpolation.js";
export const calendarVariables = [
    "日历.下一个",
    "日历.今日",
    "日历.今日节日",
    "日历.今年剩余",
    "日历.节日名称",
    "日历.下个节日名称",
    "日历.剩余天数",
    "日历.节日日期",
    "日历.开始日期",
    "日历.结束日期",
    "日历.天数",
] as const;
export const calendarVariableDescriptions: Record<(typeof calendarVariables)[number], string> = {
    "日历.下一个": "下个尚未开始的节日文案，含跨年",
    "日历.今日": "今日节日、放假或调休上班文案",
    "日历.今日节日": "今日自定义节日或已知节日日期的文案",
    "日历.今年剩余": "今天起至今年年底所有剩余节日文案",
    "日历.节日名称": "最近节日名称，优先进行中的节日",
    "日历.下个节日名称": "下个尚未开始的节日名称，含跨年",
    "日历.剩余天数": "距最近节日开始的天数，进行中为 0",
    "日历.节日日期": "最近节日的单日日期，放假区间时为空",
    "日历.开始日期": "最近节日的放假开始日期，单日节日时为空",
    "日历.结束日期": "最近节日的放假结束日期，单日节日时为空",
    "日历.天数": "最近节日的放假天数，单日节日时为空",
};
export const calendarVariableGroups = [
    { label: "完整文案", variables: ["日历.下一个", "日历.今日", "日历.今日节日", "日历.今年剩余"] },
    {
        label: "最近节日",
        variables: ["日历.节日名称", "日历.剩余天数", "日历.节日日期", "日历.开始日期", "日历.结束日期", "日历.天数"],
    },
    { label: "下个节日", variables: ["日历.下个节日名称"] },
];
export async function calendarValues(config: CalendarConfig, sources: Source[], due: number) {
    const day = dateAt(due),
        service = calendarService(config, sources, due),
        copy = config.calendarCopy;
    const [nearest, next, today, remaining] = await Promise.all([
        service.getNearestEvent(day),
        service.getNextEvent(day),
        service.getDayStatus(day),
        service.getRemainingEvents(+day.slice(0, 4), day),
    ]);
    const events = service.events;
    const h = nearest.data;
    const reference = h?.kind === "reference" || h?.kind === "event";
    const fields = {
        name: h?.name ?? "",
        date: reference ? h.start : "",
        start: !reference ? (h?.start ?? "") : "",
        end: !reference ? (h?.end ?? "") : "",
        days_until: h ? String(Math.max(0, Math.round((Date.parse(h.start) - Date.parse(day)) / DAY))) : "",
        days_off: h && !reference ? String(Math.round((Date.parse(h.end) - Date.parse(h.start)) / DAY) + 1) : "",
    };

    const todayText =
        today.status === "unknown"
            ? ""
            : today.data.kind === "ordinary"
                ? copy.ordinary
                : expand(today.data.kind === "makeup" ? copy.makeupToday : copy.today, {
                    name: today.data.names.join("、"),
                });
    const eventText = today.data.events.map((event) => expand(copy.eventToday, { name: event.name })).join("");
    const renderRemaining = () => renderCalendarQuery(remaining, "remaining", copy, day, events);
    let remainingText: string | undefined;
    return {
        "日历.今日节日": eventText,
        get "日历.今年剩余"() {
            return (remainingText ??= renderRemaining());
        },
        "日历.下一个": renderCalendarQuery(next, "next", copy, day, events),
        "日历.今日": withFreshness(eventText + todayText, today.freshness, copy, day),
        ...Object.fromEntries(
            Object.entries({
                "日历.节日名称": fields.name,
                "日历.下个节日名称": next.data?.name ?? "",
                "日历.剩余天数": fields.days_until,
                "日历.节日日期": fields.date,
                "日历.开始日期": fields.start,
                "日历.结束日期": fields.end,
                "日历.天数": fields.days_off,
            }).map(([k, v]) => [k, expand("{{value}}", { value: v })]),
        ),
    };
}
