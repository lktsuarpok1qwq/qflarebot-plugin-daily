import { registerCommands } from "./shared/declarations.js";
import { commands } from "./content/definition.js";
import type { Config, CommandName } from "./types.js";
import type { Ctx } from "./shared/types.js";
import { readConfig } from "./data/repository.js";
import { dateAt } from "./shared/date.js";
import { expand, commandLink } from "./shared/interpolation.js";
import { executeCommand } from "./content/execute-command.js";
import { registry } from "./modules/index.js";

export const moduleCommands = registry.commands(executeCommand);
export const commandLinks = Object.keys(moduleCommands).filter((name) => !/\s/.test(name)).map((name) => commandLink("/" + name, "/" + name)).join(" · ");

export async function renderCommand(ctx: Ctx, name: CommandName, override?: Config, now = Date.now()) {
    const config = override ?? await readConfig(ctx.db),
        day = dateAt(now);

    return { buttons: config.buttons?.["command:" + name], text: expand(config.replies[name].body, { today: day, year: day.slice(0, 4) }, { commands: commandLinks }) };
}

export const coreCommands = registerCommands(commands, executeCommand, (input, name) => renderCommand(input.ctx, name as CommandName));
