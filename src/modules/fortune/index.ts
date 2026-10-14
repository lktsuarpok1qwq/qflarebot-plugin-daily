import type { ModuleDefinition } from "../../shared/modules.js";
import { configAdmin } from "../../shared/admin.js";
import { copyContract, commands, settings } from "./definition.js";
import { install, snapshot, save } from "./repository.js";
import { corpus } from "./corpus.js";
import { renderCardCommand } from "./cards/command.js";
import { installCards } from "./cards/store.js";
import { cardRoutes, cleanupCards } from "./cards/media.js";
import { renderFortuneText } from "./cards/text.js";
import { fortunePage } from "./ui/page.js";
export const fortune: ModuleDefinition = {
    id: "fortune", title: "运势", permissions: ["db"], install: async (ctx) => { await install(ctx); await installCards(ctx.db); }, routes: cardRoutes,
    cleanup: cleanupCards, copy: copyContract,
    commands: {
        definitions: commands, render: async (input, name) => {
            const { ctx, session } = input;
            const { config } = await snapshot(ctx.db);

            if (name === "运势") { return { text: config.copy.help }; }

            if (!session.userId.trim()) { return { text: config.copy.noIdentity }; }

            return renderCardCommand(input, name, config);
        }
    },
    admin: configAdmin({ label: "运势", snapshot, save, present: (state) => ({ ...state, corpusStatus: corpus.status }), declaration: () => ({ copyEditor: copyContract.editor, settings }) }),
    ui: { source: `const renderFortuneText = ${renderFortuneText.toString()};` + fortunePage, sections: [{ id: "settings", title: "设置", factory: "createFortuneSettings" }, { id: "copy", title: "文案", factory: "createFortuneCopyEditor" }] },
};
