import type { Binding, Config, Rendered, Source, Task } from "../types.js";
import { activeHolidays } from "../scheduler/events.js";
import { dateAt, DAY } from "../scheduler/planner.js";
import { holidayService } from "./holiday.js";
import { validateTemplate, expand } from "./templates.js";
export async function renderMessage(
  task: Task,
  binding: Binding,
  config: Config,
  due: number,
  sources: Source[] = [],
  sharedService?: ReturnType<typeof holidayService>,
  events: string[] = [],
): Promise<Rendered> {
  const format =
    binding.overrideText !== null ? binding.overrideFormat : task.format;
  const calendarVariables = (body: string) =>
    body.includes("{{holiday.") || body.includes("{{festival.");
  const needsCalendar =
    binding.overrideText !== null
      ? calendarVariables(binding.overrideText)
      : events.length > 0 ||
        calendarVariables(task.title) ||
        config.contents.some(
          (c) =>
            c.enabled &&
            task.contentIds.includes(c.id) &&
            ((c.only && c.only !== "always") ||
              c.referenceBody ||
              calendarVariables(c.body)),
        );
  const day = dateAt(due),
    service = needsCalendar
      ? (sharedService ?? holidayService(config, sources, due))
      : undefined,
    items: Rendered["items"] = [];
  const ids = new Set(events.map((key) => key.split(":")[0]));
  const boundFestival = config.festivals.find((f) => ids.has(f.id));
  const matched = (service ? activeHolidays(config) : []).filter(
    (h) =>
      service!.hasEvent(h.id) &&
      (ids.has(h.id) || (h.festivalIds ?? []).some((id) => ids.has(id))),
  );
  const closest =
    matched[0] ?? boundFestival ?? (await service?.getNextEvent(day))?.data;
  const reference = !!closest && "date" in closest;
  const h =
    closest && "start" in closest
      ? {
          ...closest,
          name: matched.length
            ? matched.map((h) => h.name).join(" / ")
            : closest.name,
          end: matched.length
            ? matched
                .map((h) => h.end)
                .sort()
                .at(-1)!
            : closest.end,
        }
      : null;
  const festival =
    boundFestival ??
    (reference ? closest : await service?.getNextFestival(day));
  async function render(body: string): Promise<string | null> {
    validateTemplate(body);
    if (body.includes("{{holiday.") && !h) return null;
    if (body.includes("{{festival.") && !festival) return null;
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
      "holiday.days_off": h
        ? String(
            Math.round((Date.parse(h.end) - Date.parse(h.start)) / DAY) + 1,
          )
        : "",
      "festival.name": festival?.name ?? "",
      "festival.date": festival?.date ?? "",
      "festival.days_until": festival
        ? String(
            Math.max(
              0,
              Math.round((Date.parse(festival.date) - Date.parse(day)) / DAY),
            ),
          )
        : "",
    };
    return expand(body, vars, format === "markdown").trim();
  }
  let text: string;
  if (binding.overrideText !== null) {
    const value = await render(binding.overrideText);
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
        const status = await service!.getDayStatus(day);
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
      const value = await render(
        reference && c.referenceBody ? c.referenceBody : c.body,
      );
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
    const title = parts.length && task.title ? await render(task.title) : "";
    if (title === null) {
      items.push({ contentId: "title", reason: "holiday_data_unknown" });
      text = "";
    } else
      text = parts.length
        ? [title, ...parts].filter(Boolean).join(task.separator)
        : "";
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text))
    throw new Error("最终消息包含控制字符");
  return { text, format, items };
}
