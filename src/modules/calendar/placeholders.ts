import type { Config, Source } from "../../types.js";
import { calendarService } from "./service.js";
import { dateAt, DAY } from "../../scheduler/planner.js";
import { expand } from "../../content/interpolation.js";
export const calendarVariables = [
    "日历.下一个",
    "日历.今日",
    "日历.今日节日",
    "日历.今年剩余",
    "日历.名称",
    "日历.剩余天数",
    "日历.节日日期",
    "日历.开始日期",
    "日历.结束日期",
    "日历.天数",
] as const;
export async function calendarValues(config: Config, sources: Source[], due: number) {
    const day = dateAt(due),
        service = calendarService(config, sources, due),
        copy = config.calendarCopy;
    const [next, today, remaining] = await Promise.all([
        service.getNextEvent(day),
        service.getDayStatus(day),
        service.getRemainingEvents(+day.slice(0, 4), day),
    ]);
    const h = next.data;
    const reference = h?.kind === "reference" || h?.kind === "event";
    const fields = {
        name: h?.name ?? "",
        date: reference ? h.start : "",
        start: !reference ? (h?.start ?? "") : "",
        end: !reference ? (h?.end ?? "") : "",
        days_until: h ? String(Math.max(0, Math.round((Date.parse(h.start) - Date.parse(day)) / DAY))) : "",
        days_off: h && !reference ? String(Math.round((Date.parse(h.end) - Date.parse(h.start)) / DAY) + 1) : "",
        ongoing: h && !reference && h.start <= day ? copy.ongoing : "",
    };
    const summary = h
        ? expand(h.kind === "event" ? copy.event : reference ? copy.reference : copy.summary, fields, {
              ongoing: fields.ongoing,
          })
        : next.status === "none"
          ? copy.none
          : copy.unknown;
    const todayText =
        today.status === "unknown"
            ? copy.unknown
            : today.data.kind === "ordinary"
              ? copy.ordinary
              : expand(today.data.kind === "makeup" ? copy.makeupToday : copy.today, {
                    name: today.data.names.join("、"),
                });
    const eventText = today.data.events.map((event) => expand(copy.eventToday, { name: event.name })).join("");
    const renderRemaining = () =>
        remaining.status === "known"
            ? expand(
                  copy.remaining,
                  {
                      year: day.slice(0, 4),
                      today: day,
                      count: String(remaining.data.length),
                  },
                  {
                      items: remaining.data
                          .map((event) => {
                              const values = {
                                  name: event.name,
                                  date: event.start,
                                  start: event.start,
                                  end: event.end,
                                  days_until: String(
                                      Math.max(0, Math.round((Date.parse(event.start) - Date.parse(day)) / DAY)),
                                  ),
                                  days_off: String(
                                      Math.round((Date.parse(event.end) - Date.parse(event.start)) / DAY) + 1,
                                  ),
                              };
                              return expand(
                                  event.kind === "event"
                                      ? copy.event
                                      : event.kind === "reference"
                                        ? copy.reference
                                        : copy.summary,
                                  values,
                                  {
                                      ongoing: event.kind === "holiday" && event.start <= day ? copy.ongoing : "",
                                  },
                              );
                          })
                          .join(""),
                      stale: remaining.freshness === "stale" ? copy.stale : "",
                  },
              )
            : (remaining.status === "none" ? copy.none : copy.unknown) +
              (remaining.freshness === "stale" ? copy.stale : "");
    let remainingText: string | undefined;
    return {
        "日历.今日节日": eventText,
        get "日历.今年剩余"() {
            return (remainingText ??= renderRemaining());
        },
        "日历.下一个": summary + (next.freshness === "stale" ? copy.stale : ""),
        "日历.今日": eventText + todayText + (today.freshness === "stale" ? copy.stale : ""),
        ...Object.fromEntries(
            Object.entries({
                "日历.名称": fields.name,
                "日历.剩余天数": fields.days_until,
                "日历.节日日期": fields.date,
                "日历.开始日期": fields.start,
                "日历.结束日期": fields.end,
                "日历.天数": fields.days_off,
            }).map(([k, v]) => [k, expand("{{value}}", { value: v })]),
        ),
    };
}
