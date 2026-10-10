import type { CommandInput } from "@qqbot/sdk";
import type { Ctx, Config, CommandName, Rendered, Source } from "./types.js";
import { readData, snapshot } from "./data/repository.js";
import { renderHolidayReply } from "./modules/holiday/reply.js";
import { dateAt } from "./scheduler/planner.js";
import { expand } from "./content/interpolation.js";
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
  if (!queriesCalendar(name))
    return {
      text: expand(reply.body, values),
    };
  return renderHolidayReply(config, raw, name, now);
}

export async function command(input: CommandInput, name: CommandName) {
  let reply = defaultReplies()[name];
  const hint = (body: string) =>
    message(
      expand(body, {
        today: dateAt(Date.now()),
        year: dateAt(Date.now()).slice(0, 4),
      }),
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
    const sent = await input.session.reply(message(result.text));
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
