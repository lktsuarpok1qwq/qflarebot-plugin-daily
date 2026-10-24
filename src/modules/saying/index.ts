import { copyContract, commands, sayingSample } from "./definition.js";
import type { ModuleDefinition } from "../../shared/modules.js";
import { install } from "./repository.js";
import { createResolver, queryReply, render } from "./service.js";
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
        definitions: commands, render: async (input) => queryReply(input.ctx, "body")
    },
    admin: api,
    ui: { sections: [{ id: "copy", title: "文案", factory: "createCopyEditor" }] },
};
