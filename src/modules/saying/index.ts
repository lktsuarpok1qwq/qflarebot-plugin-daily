import type { ModuleAPI } from "../contract.js";
import { install, snapshot, backup } from "./repository.js";
import { createResolver, render } from "./service.js";
import { randomSaying } from "./provider.js";
import { SAYING_VARIABLES, SAYING_DESCRIPTIONS } from "./copy.js";
import { api } from "./admin.js";
import { sayingPage } from "./ui.js";
export const saying: ModuleAPI = {
    id: "saying",
    install,
    variables: SAYING_VARIABLES,
    variableDescriptions: SAYING_DESCRIPTIONS,
    variableGroups: [{ label: "完整文案", variables: SAYING_VARIABLES }],
    createResolver,
    commands: (execute) => ({
        一言: {
            description: "随机一句话",
            scenes: ["group", "c2c"],
            handler: (input) => execute(input, "一言", async () => {
                const state = await snapshot(input.ctx.db);
                return { text: render(state.config, await randomSaying()) };
            }),
        },
    }),
    routes: (["GET", "POST"] as const).map((method) => ({ method, path: "/api/saying/:action", auth: "admin" as const, handler: api })),
    ui: { title: "一言", source: sayingPage, factory: "createSayingPage" },
    backup,
};
