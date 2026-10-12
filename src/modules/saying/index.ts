import { copyContract, commands, sayingSample } from "./definition.js";
import type { ModuleDefinition } from "../../shared/modules.js";
import { install, snapshot } from "./repository.js";
import { createResolver, render } from "./service.js";
import { randomSaying } from "./provider.js";
import { sayingVariables, SAYING_COPY } from "./copy.js";
import { api } from "./admin.js";
export const saying: ModuleDefinition = {
    id: "saying",
    title: "一言",
    permissions: ["db", "net"],
    install,
    copy: copyContract,
    variables: {
        ...sayingVariables,
        sampleVariables: () => ({ "一言.今日": render({ schemaVersion: 1, copy: SAYING_COPY }, "today", sayingSample.values.text) }),
        createResolver
    },
    commands: {
        definitions: commands, render: async (input) => {
            const state = await snapshot(input.ctx.db);
            return { text: state.config.copy.body.includes("{{text}}") ? render(state.config, "body", await randomSaying()) : state.config.copy.body };
        }
    },
    admin: api,
    ui: { factory: "createCopyEditor" },
};
