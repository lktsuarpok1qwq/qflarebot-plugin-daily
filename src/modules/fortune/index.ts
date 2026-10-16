import { backgrounds } from "./cards/backgrounds/index.js";
import { bindCards } from "../../shared/cards/store.js";
import { fortuneDesigns } from "./cards/design.js";
import type { ModuleDefinition } from "../../shared/modules.js";
import { configAdmin } from "../../shared/admin.js";
import { copyContract, commands, settings } from "./definition.js";
import { install, snapshot, save } from "./repository.js";
import { corpus } from "./corpus.js";
import { renderCardCommand } from "./cards/command.js";
import { installCards, resetCards } from "./cards/store.js";
import { cardRoutes, cleanupCards } from "./cards/media.js";
import { renderFortuneText } from "./cards/text.js";
import { dateAt, validDate } from "../../shared/date.js";
import { body } from "../../shared/request.js";
import { AdminError } from "../../shared/admin-errors.js";
import { fortunePage } from "./ui/page.js";
export const fortune: ModuleDefinition = {
    id: "fortune", cards: bindCards(fortuneDesigns, { snapshot, save }, backgrounds), title: "运势", permissions: ["db", "net"], install: async (ctx) => { await install(ctx); await installCards(ctx.db); }, routes: cardRoutes,
    cleanup: cleanupCards, copy: copyContract,
    commands: {
        definitions: commands, render: async (input, name) => {
            const { ctx, session } = input;

            if (name === "运势" || !session.userId.trim()) {
                const { config } = await snapshot(ctx.db);
                return { text: name === "运势" ? config.copy.help : config.copy.noIdentity };
            }

            return renderCardCommand(input, name);
        }
    },
    admin: configAdmin({
        label: "运势", snapshot, save, present: (state) => ({ ...state, corpusStatus: corpus.status, today: dateAt(Date.now()) }),
        declaration: () => ({ copyEditor: copyContract.editor, settings }),
        actions: {
            "reset-today": async ({ ctx, request }) => {
                const data = await body(request), today = dateAt(Date.now());

                if (typeof data.day !== "string" || !validDate(data.day)) { throw new AdminError("validation", "重置日期无效"); }

                if (data.day !== today) { throw new AdminError("conflict", "日期已变化，请刷新页面后重试"); }

                await resetCards(ctx.db, today);
                return Response.json({ day: today });
            },
        },
    }),
    ui: { get source() { return `const renderFortuneText = ${renderFortuneText.toString()};` + fortunePage; }, sections: [{ id: "settings", title: "设置", factory: "createFortuneSettings" }, { id: "cards", title: "卡面", factory: "createCardEditor" }, { id: "copy", title: "文案", factory: "createFortuneCopyEditor" }] },
};
