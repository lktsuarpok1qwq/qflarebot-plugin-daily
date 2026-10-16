import { CardImageError } from "../../../shared/cards/render.js";
import type { CommandInput } from "@qqbot/sdk";
import type { Rendered } from "../../../shared/types.js";
import { expand } from "../../../shared/interpolation.js";
import { renderFortuneText } from "./text.js";
import type { CardSnapshot } from "./store.js";
import { dateAt } from "../../../shared/date.js";
import { readCommandState } from "../repository.js";
import { cardLabels } from "./labels.js";
import { drawCard } from "./draw.js";
import { userKey, claimCard, markDrawn } from "./store.js";
import { cardImage } from "./media.js";
import { errorDetails } from "../../../shared/diagnostics.js";
export async function renderCardCommand({ ctx, session }: CommandInput, name: string): Promise<Rendered> {
    const day = dateAt(Date.now()), id = await userKey(ctx.botId, session.userId);
    const { config, card } = await readCommandState(ctx.db, id);
    let row = card;
    let fresh: CardSnapshot | undefined;

    if (name === "运势 解" && (row?.day !== day || !row.drawn)) { return { text: config.copy.needDraw }; }

    if (row?.day !== day) {
        const content = drawCard(id, day, config);
        const labels = cardLabels(config.copy);
        const claimed = await claimCard(ctx.db, id, day, { content, labels });
        row = claimed.row;
        fresh = claimed.fresh;
    }

    const view = name === "运势 抽" ? "small" : "detail", height = view === "small" ? 300 : 850;
    const selected = row;
    const afterSend = view === "small" && !row.drawn ? () => markDrawn(ctx.db, selected) : undefined;
    const textFallback = () => renderFortuneText(config.copy, view, fresh ?? JSON.parse(row.snapshot) as CardSnapshot, expand);

    if (config.imageEnabled) {
        try {
            const image = await cardImage(ctx, row, view, config.cardDesigns, fresh);
            const text = `![运势 #540px #${height}px](${image.url})\n\n${view === "small" ? config.copy.drawCaption : config.copy.detailCaption}`;
            return { text, reply: { markdown: { content: text, forceVerifyImage: true } }, imageFallback: textFallback, diagnostics: image.diagnostics, afterSend };
        } catch (error) {
            const diagnostics = error instanceof CardImageError ? error.diagnostics : errorDetails(error);
            const stage = error instanceof CardImageError ? error.stage : "public_address";
            ctx.logger.warn("运势图片准备失败，使用文字回复", { ...diagnostics, command: name, stage, view });
            return { text: textFallback(), diagnostics: { ...diagnostics, imagePrepareFailed: true, imagePrepareStage: stage }, afterSend };
        }
    }

    return { text: textFallback(), afterSend };
}
