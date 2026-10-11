import type { CommandInput } from "@qqbot/sdk";
import type { Config, CommandName } from "./types.js";
import type { Ctx } from "./shared/types.js";
import { snapshot } from "./data/repository.js";
import { dateAt } from "./shared/date.js";
import { expand } from "./shared/interpolation.js";
import { executeCommand } from "./content/execute-command.js";
export async function renderCommand(ctx: Ctx, name: CommandName, override?: Config, now = Date.now()) {
    const config = override ?? (await snapshot(ctx.db)).config,
        day = dateAt(now);
    return { text: expand(config.replies[name].body, { today: day, year: day.slice(0, 4) }) };
}
export function command(input: CommandInput, name: CommandName) {
    return executeCommand(input, name, () => renderCommand(input.ctx, name));
}
