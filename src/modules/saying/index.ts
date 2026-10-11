import { commands, sayingSample } from "./definition.js";
import { registerCommands } from "../../shared/declarations.js";
import type { ModuleAPI } from "../contract.js";
import { install, snapshot } from "./repository.js";
import { createResolver, render } from "./service.js";
import { randomSaying } from "./provider.js";
import { sayingVariables, SAYING_COPY } from "./copy.js";
import { api } from "./admin.js";
export const saying: ModuleAPI = {
    id: "saying",
    install,
    ...sayingVariables,
    sampleVariables: () => ({ "一言.今日": render({ schemaVersion: 1, copy: SAYING_COPY }, "today", sayingSample.values.text) }),
    createResolver,
    commands: (execute) => registerCommands(commands, execute, async (input) => {
        const state = await snapshot(input.ctx.db);
        return { text: state.config.copy.body.includes("{{text}}") ? render(state.config, "body", await randomSaying()) : state.config.copy.body };
    }),
    admin: api,
    ui: { title: "一言", source: "", factory: "createCopyEditor" },
};
