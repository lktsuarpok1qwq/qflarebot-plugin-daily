import type { ModuleDefinition } from "../../shared/modules.js";
import { configAdmin } from "../../shared/admin.js";
import { dateAt } from "../../shared/date.js";
import { expand } from "../../shared/interpolation.js";
import { copyContract, commands, settings } from "./definition.js";
import { install, snapshot, save } from "./repository.js";
import { corpus } from "./corpus.js";
import { generateFortune } from "./service.js";
import { renderFortune } from "./rendering.js";
import { fortunePage } from "./ui/page.js";
export const fortune: ModuleDefinition = {
    id: "fortune", title: "运势", permissions: ["db"], install, copy: copyContract,
    commands: {
        definitions: commands, render: async ({ ctx, session }, name) => {
            const { config } = await snapshot(ctx.db);

            if (name === "运势") { return { text: renderFortune(config.copy, { kind: "help" }, expand) }; }

            if (!session.userId.trim()) { return { text: renderFortune(config.copy, { kind: "noIdentity" }, expand) }; }

            const parts = new Set((["good", "bad", "effect", "item", "egg"] as const).filter((key) => config.copy.body.includes("{{" + key + "}}") && config.copy[key]));
            const result = corpus.data ? generateFortune({ userId: session.userId, date: dateAt(Date.now()), config, corpus: corpus.data, parts }) : undefined;
            return { text: renderFortune(config.copy, result ? { kind: "draw", result } : { kind: "unavailable" }, expand) };
        }
    },
    admin: configAdmin({ label: "运势", snapshot, save, present: (state) => ({ ...state, corpusStatus: corpus.status }), declaration: () => ({ copyEditor: copyContract.editor, settings }) }),
    ui: { source: `const renderFortuneSample = ${renderFortune.toString()};` + fortunePage, sections: [{ id: "settings", title: "设置", factory: "createFortuneSettings" }, { id: "copy", title: "文案", factory: "createFortuneCopyEditor" }] },
};
