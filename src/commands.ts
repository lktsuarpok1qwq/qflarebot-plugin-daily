import type { CommandInput } from "@qqbot/sdk";
import type { Config, CommandName } from "./types.js";
import type { Ctx } from "./shared/types.js";
import { snapshot } from "./data/repository.js";
import { dateAt } from "./shared/date.js";
import { expand, commandLink } from "./shared/interpolation.js";
import { executeCommand } from "./content/execute-command.js";
import { modules } from "./modules/index.js";
export const moduleCommands = Object.fromEntries(modules.flatMap((module) => Object.entries(module.commands(executeCommand))));
const commandLinks = Object.keys(moduleCommands).filter((name) => !/\s/.test(name)).map((name) => commandLink("/" + name, "/" + name)).join(" · ");
export async function renderCommand(ctx: Ctx, name: CommandName, override?: Config, now = Date.now()) {
    const config = override ?? (await snapshot(ctx.db)).config,
        day = dateAt(now);
    return { text: expand(config.replies[name].body, { today: day, year: day.slice(0, 4) }, { commands: commandLinks }) };
}
export function command(input: CommandInput, name: CommandName) {
    return executeCommand(input, name, () => renderCommand(input.ctx, name));
}
