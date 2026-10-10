import type { Ctx } from "./types.js";
import { snapshot, readData } from "./data/repository.js";
import { holidayService } from "./content/holiday.js";
import { dateAt } from "./scheduler/planner.js";
export async function help(ctx: Ctx, kind: "daily" | "holiday") {
  return (await snapshot(ctx.db)).config.help[kind];
}
export async function queryHoliday(ctx: Ctx, mode: "next" | "remaining") {
  const { snapshot: s, sources: raw } = await readData(ctx.db),
    service = holidayService(s.config, raw),
    day = dateAt(Date.now());
  const q =
    mode === "next"
      ? await service.getNextHoliday(day)
      : await service.getRemainingHolidays(+day.slice(0, 4), day);
  if (q.status === "none")
    return mode === "remaining"
      ? "今年已没有剩余假期，可用 /假期 下一个 查询下一段假期（含跨年）。"
      : "已公布的记录中没有后续假期。";
  if (q.status === "unknown")
    return "后续假期安排尚未公布或数据尚未同步，可稍后同步或手动录入。";
  const rows = Array.isArray(q.data) ? q.data : q.data ? [q.data] : [];
  const suffix =
    q.freshness === "stale" ? "\n数据源暂未更新，使用最近可信版本。" : "";
  const lines: string[] = [];
  const length = (text: string) => [...text].length;
  const omitted = (count: number) =>
    count ? `\n另有 ${count} 项未展示。` : "";
  const budget =
    s.config.textLimit - length(suffix) - length(omitted(rows.length)) - 1;
  for (const h of rows) {
    const dates = `：${h.start} 至 ${h.end}${h.start <= day ? "（进行中）" : ""}`;
    let line = h.name + dates;
    if (!lines.length && length(line) > budget) {
      const count = Math.max(1, budget - length(dates) - 1);
      line = [...h.name].slice(0, count).join("") + "…" + dates;
    }
    if (length([...lines, line].join("\n")) > budget) break;
    lines.push(line);
  }
  return lines.join("\n") + omitted(rows.length - lines.length) + suffix;
}
