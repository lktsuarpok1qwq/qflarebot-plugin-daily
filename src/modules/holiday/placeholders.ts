import type { Config, Source } from "../../types.js";
import { holidayService } from "./service.js";
import { dateAt, DAY } from "../../scheduler/planner.js";
import { expand } from "../../content/interpolation.js";
export const holidayVariables = [
  "假期.概览",
  "假期.今日",
  "假期.名称",
  "假期.剩余天数",
  "假期.开始日期",
  "假期.结束日期",
  "假期.天数",
] as const;
export async function holidayValues(
  config: Config,
  sources: Source[],
  due: number,
) {
  const day = dateAt(due),
    service = holidayService(config, sources, due),
    copy = config.holidayCopy;
  const [next, today] = await Promise.all([
    service.getNextEvent(day),
    service.getDayStatus(day),
  ]);
  const h = next.data;
  const fields = {
    name: h?.name ?? "",
    start: h?.start ?? "",
    end: h?.end ?? "",
    days_until: h
      ? String(
          Math.max(
            0,
            Math.round((Date.parse(h.start) - Date.parse(day)) / DAY),
          ),
        )
      : "",
    days_off: h
      ? String(Math.round((Date.parse(h.end) - Date.parse(h.start)) / DAY) + 1)
      : "",
    ongoing: h && h.start <= day ? copy.ongoing : "",
  };
  const summary = h
    ? expand(copy.summary, fields, { ongoing: fields.ongoing })
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
  return {
    "假期.概览": summary + (next.freshness === "stale" ? copy.stale : ""),
    "假期.今日": todayText + (today.freshness === "stale" ? copy.stale : ""),
    ...Object.fromEntries(
      Object.entries({
        "假期.名称": fields.name,
        "假期.剩余天数": fields.days_until,
        "假期.开始日期": fields.start,
        "假期.结束日期": fields.end,
        "假期.天数": fields.days_off,
      }).map(([k, v]) => [k, expand("{{value}}", { value: v })]),
    ),
  };
}
