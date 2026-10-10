import type { CommandInput } from "@qqbot/sdk";
import type {
  Ctx,
  Config,
  CommandName,
  Holiday,
  Festival,
  Rendered,
  Source,
} from "./types.js";
import { readData, snapshot } from "./data/repository.js";
import { holidayService, eventDate } from "./content/holiday.js";
import { dateAt, DAY } from "./scheduler/planner.js";
import { expand } from "./content/templates.js";
import { message } from "./content/message.js";
import { defaultReplies } from "./content/command-templates.js";
const queriesCalendar = (name: CommandName) =>
  name === "假期 下一个" || name === "假期 剩余";

async function commandData(ctx: Ctx, name: CommandName) {
  return queriesCalendar(name)
    ? readData(ctx.db)
    : { snapshot: await snapshot(ctx.db), sources: [] as Source[] };
}
export async function renderCommand(
  ctx: Ctx,
  name: CommandName,
  override?: Config,
  now = Date.now(),
  cachedSources?: Source[],
): Promise<Rendered> {
  const data =
    override && (cachedSources || !queriesCalendar(name))
      ? { snapshot: { config: override }, sources: cachedSources ?? [] }
      : await commandData(ctx, name);
  const raw = data.sources;
  const config = override ?? data.snapshot.config,
    reply = config.replies[name],
    day = dateAt(now);
  const values = { today: day, year: day.slice(0, 4) };
  const format = reply.format;
  if (!queriesCalendar(name))
    return {
      text: expand(reply.body, values, format === "markdown"),
      format,
      items: [],
    };
  const service = holidayService(config, raw, now);
  const q =
    name === "假期 下一个"
      ? await service.getNextEvent(day)
      : await service.getRemainingEvents(+day.slice(0, 4), day);
  if (q.status !== "known")
    return {
      text: expand(
        q.status === "none" ? reply.empty : reply.unknown,
        values,
        format === "markdown",
      ),
      format,
      items: [],
    };
  const rows: (Holiday | Festival)[] = Array.isArray(q.data)
    ? q.data
    : q.data
      ? [q.data]
      : [];
  const lines = rows.map((h) => {
    const reference = "date" in h;
    const date = eventDate(h);
    const vars = {
      ...values,
      name: h.name,
      date: reference ? h.date : "",
      start: reference ? "" : h.start,
      end: reference ? "" : h.end,
      days_until: String(
        Math.max(0, Math.round((Date.parse(date) - Date.parse(day)) / DAY)),
      ),
      days_off: reference
        ? ""
        : String(
            Math.round((Date.parse(h.end) - Date.parse(h.start)) / DAY) + 1,
          ),
      makeup: reference
        ? ""
        : config.holidays
            .filter(
              (m) =>
                m.kind === "makeup" &&
                m.name === h.name &&
                m.source === h.source &&
                m.start.slice(0, 4) >= h.start.slice(0, 4) &&
                m.start.slice(0, 4) <= h.end.slice(0, 4),
            )
            .map((m) => m.start)
            .join("、") || expand(reply.makeupEmpty, values),
      source: h.source === "uapi" ? "UAPI" : h.source,
      ongoing: "",
    };
    const ongoing =
      !reference && h.start <= day
        ? expand(reply.ongoing, vars, format === "markdown")
        : "";
    // Expand values once; rendered fragments must not be escaped or interpreted again.
    const template = reference ? reply.provisional : reply.official;
    return template.replace(/\{\{([^{}]+)\}\}/g, (token, key: string) =>
      key === "ongoing" ? ongoing : expand(token, vars, format === "markdown"),
    );
  });
  const fragments: Record<string, string> = {
    items: lines.join(expand(reply.separator, values, format === "markdown")),
    stale:
      q.freshness === "stale"
        ? expand(reply.stale, values, format === "markdown")
        : "",
  };
  const text = reply.body.replace(/\{\{([^{}]+)\}\}/g, (token, key: string) =>
    Object.hasOwn(fragments, key)
      ? fragments[key]!
      : expand(
          token,
          { ...values, count: String(rows.length) },
          format === "markdown",
        ),
  );
  return { text, format, items: [] };
}
export async function command(input: CommandInput, name: CommandName) {
  let reply = defaultReplies()[name];
  const hint = (body: string) =>
    message(
      expand(
        body,
        { today: dateAt(Date.now()), year: dateAt(Date.now()).slice(0, 4) },
        reply.format === "markdown",
      ),
      reply.format,
    );
  let result: Rendered;
  try {
    const { snapshot: s, sources } = await commandData(input.ctx, name);
    reply = s.config.replies[name];
    result = await renderCommand(
      input.ctx,
      name,
      s.config,
      Date.now(),
      sources,
    );
  } catch (error) {
    input.ctx.logger.warn("命令查询失败", {
      command: name,
      error: String(error),
    });
    return hint(reply.error);
  }
  try {
    const sent = await input.session.reply(message(result.text, result.format));
    if (!sent.ok) {
      input.ctx.logger.warn("命令回复失败", {
        command: name,
        code: sent.code,
        error: sent.error,
      });
      if (sent.code === 40054007) return hint(reply.tooLong);
    }
  } catch (error) {
    input.ctx.logger.warn("命令回复状态不确定", {
      command: name,
      error: String(error),
    });
  }
}
