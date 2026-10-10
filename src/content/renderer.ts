import type { Binding, Config, Rendered, Source, Task } from "../types.js";
import { dateAt, DAY } from "../scheduler/planner.js";
import { holidayService } from "./holiday.js";
import { validateTemplate } from "./templates.js";
export async function renderMessage(
  task: Task,
  binding: Binding,
  config: Config,
  due: number,
  sources: Source[] = [],
  sharedService?: ReturnType<typeof holidayService>,
  events: string[] = [],
): Promise<Rendered> {
  const day = dateAt(due),
    service = sharedService ?? holidayService(config, sources, due),
    items: Rendered["items"] = [];
  const cached = new Map<
    string,
    Awaited<ReturnType<typeof service.getNextHoliday>>
  >();
  async function render(body: string, region = "CN"): Promise<string | null> {
    validateTemplate(body, config.textLimit);
    let next = cached.get(region);
    if (body.includes("{{holiday.")) {
      if (!next) {
        const matched = config.holidays.filter(
          (h) =>
            service.isVerified(h.id) &&
            h.region === region &&
            events.some((key) => key.split(":")[0] === h.id),
        );
        if (matched.length) {
          const first = matched[0]!;
          next = {
            status: "known",
            data: {
              ...first,
              name: matched.map((h) => h.name).join(" / "),
              end: matched
                .map((h) => h.end)
                .sort()
                .at(-1)!,
            },
            coverage: { from: first.start, to: first.start, complete: true },
            sources: matched.map((h) => h.source),
            freshness: "current",
          };
        } else {
          next = await service.getNextHoliday(region, day);
        }
        cached.set(region, next);
      }
      if (next.status !== "known" || !next.data) return null;
    }
    const h = next?.data;
    const vars: Record<string, string> = {
      "date.today": day,
      "date.weekday": `星期${"日一二三四五六"[new Date(day).getUTCDay()]}`,
      "holiday.next_name": h?.name ?? "",
      "holiday.days_until": h
        ? String(
            Math.max(
              0,
              Math.round((Date.parse(h.start) - Date.parse(day)) / DAY),
            ),
          )
        : "",
      "holiday.start_date": h?.start ?? "",
      "holiday.end_date": h?.end ?? "",
    };
    return body.replace(/\{\{([^{}]+)\}\}/g, (_, k: string) => vars[k]!).trim();
  }
  let text: string;
  if (binding.overrideText !== null) {
    const value = await render(binding.overrideText, task.schedule.region);
    items.push({
      contentId: "override",
      reason:
        value === null ? "holiday_data_unknown" : value ? "included" : "blank",
    });
    text = value ?? "";
  } else {
    const parts: string[] = [];
    for (const id of task.contentIds) {
      const c = config.contents.find((c) => c.id === id);
      if (!c || !c.enabled) {
        items.push({ contentId: id, reason: "disabled" });
        continue;
      }
      if (c.only && c.only !== "always") {
        const status = await service.getDayStatus(c.region ?? "CN", day);
        if (status.data.kind === "unknown") {
          items.push({ contentId: id, reason: "holiday_data_unknown" });
          continue;
        }
        if (
          status.data.kind !==
          (c.only === "makeup" ? "makeup_workday" : "holiday")
        ) {
          items.push({ contentId: id, reason: "no_matching_holiday_today" });
          continue;
        }
      }
      const value = await render(c.body, c.region);
      items.push({
        contentId: id,
        reason:
          value === null
            ? "holiday_data_unknown"
            : value
              ? "included"
              : "blank",
      });
      if (value) parts.push(value);
    }
    const title =
      parts.length && task.title
        ? await render(task.title, task.schedule.region)
        : "";
    if (title === null) {
      items.push({ contentId: "title", reason: "holiday_data_unknown" });
      text = "";
    } else
      text = parts.length
        ? [title, ...parts].filter(Boolean).join(task.separator)
        : "";
  }
  if ([...text].length > config.textLimit)
    throw new Error("最终消息超过应用文本上限");
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text))
    throw new Error("最终消息包含控制字符");
  return { text, items };
}
