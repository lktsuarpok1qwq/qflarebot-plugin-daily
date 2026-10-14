import type { CommandInput } from "@qqbot/sdk";
import type { Rendered } from "../../../shared/types.js";
import { expand } from "../../../shared/interpolation.js";
import { renderFortuneText } from "./text.js";
import type { CardSnapshot } from "./store.js";
import { dateAt } from "../../../shared/date.js";
import type { FortuneConfig } from "../config.js";
import { cardLabels } from "./labels.js";
import { drawCard } from "./draw.js";
import { userKey, readCard, claimCard, markDrawn } from "./store.js";
import { cardImage, publicOrigin } from "./media.js";
export async function renderCardCommand({ ctx, session }: CommandInput, name: string, config: FortuneConfig): Promise<Rendered> {
    const day = dateAt(Date.now()), id = await userKey(ctx.botId, session.userId);
    let row = await readCard(ctx.db, id);

    if (name === "运势 解" && (row?.day !== day || !row.drawn)) { return { text: config.copy.needDraw }; }

    if (row?.day !== day) {
        const content = drawCard(id, day, config);
        const labels = cardLabels(config.copy);
        row = await claimCard(ctx.db, id, day, { content, labels });
    }

    const view = name === "运势 抽" ? "small" : "detail", height = view === "small" ? 300 : 850;
    const selected = row;
    const afterSend = view === "small" && !row.drawn ? () => markDrawn(ctx.db, selected) : undefined;

    if (config.imageEnabled) {
        try {
            const url = await cardImage(ctx, row, view, publicOrigin(ctx));
            const text = `![运势 #540px #${height}px](${url})\n\n${view === "small" ? config.copy.drawCaption : config.copy.detailCaption}`;
            return { text, reply: { markdown: { content: text, forceVerifyImage: true } }, afterSend };
        } catch (error) {
            ctx.logger.warn("运势图片准备失败，使用文字回复", { error: String(error) });
        }
    }

    return { text: renderFortuneText(config.copy, view, JSON.parse(row.snapshot) as CardSnapshot, expand), afterSend };
}
