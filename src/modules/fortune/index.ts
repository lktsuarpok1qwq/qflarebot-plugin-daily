import { backgrounds } from "./cards/backgrounds/index.js";
import { bindCards } from "../../shared/cards/store.js";
import { fortuneDesigns } from "./cards/design.js";
import type { ModuleDefinition } from "../../shared/modules.js";
import { configAdmin } from "../../shared/admin.js";
import { copyContract, commands, settings } from "./definition.js";
import { install, snapshot, save, readPrompt } from "./repository.js";
import { corpus } from "./corpus.js";
import { renderCardCommand } from "./cards/command.js";
import { installCards } from "./cards/store.js";
import { cardRoutes, cleanupCardImages } from "./cards/media.js";
import { renderFortuneText } from "./cards/text.js";
import { fortunePage } from "./ui/page.js";
const present = (state: Awaited<ReturnType<typeof snapshot>>) => ({ ...state, corpusStatus: corpus.status });
export const fortune: ModuleDefinition = {
    id: "fortune", cards: bindCards(fortuneDesigns, { snapshot, save, present }, backgrounds), title: "运势", permissions: ["db", "net"], install: async (ctx) => { await install(ctx); await installCards(ctx.db); }, routes: cardRoutes,
    cleanupImages: cleanupCardImages, copy: copyContract,
    commands: {
        definitions: commands, render: async (input, name) => {
            const { ctx, session } = input;

            if (name === "运势" || !session.userId.trim()) {
                return { text: await readPrompt(ctx.db, name === "运势" ? "help" : "noIdentity") };
            }

            return renderCardCommand(input, name);
        }
    },
    admin: configAdmin({ label: "运势", snapshot, save, present, declaration: () => ({ copyEditor: copyContract.editor, settings }) }),
    ui: { get source() { return `const renderFortuneText = ${renderFortuneText.toString()};` + fortunePage; }, sections: [{ id: "settings", title: "设置", factory: "createFortuneSettings" }, { id: "cards", title: "卡面", factory: "createCardEditor" }, { id: "copy", title: "文案", factory: "createFortuneCopyEditor" }] },
};
