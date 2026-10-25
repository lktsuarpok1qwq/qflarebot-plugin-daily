import { imageReply } from "../../../shared/cards/reply.js";
import { CardImageError } from "../../../shared/cards/render.js";
import { errorDetails } from "../../../shared/diagnostics.js";
import type { CommandInput } from "@qqbot/sdk";
import type { Rendered } from "../../../shared/types.js";
import type { WeatherConfig } from "../types.js";
import { expand } from "../../../shared/interpolation.js";
import { queryWeather } from "../service.js";
import { weatherImage } from "./media.js";

export async function renderWeatherCommand(input: CommandInput, config: WeatherConfig, fetcher: typeof fetch = fetch): Promise<Rendered> {
    const buttons = config.buttons?.[input.args.length ? "current" : "help"];
    const result = await queryWeather(config, input.args, Date.now(), fetcher, config.imageEnabled);

    if (!result.card) { return { ...result, buttons }; }

    const copy = config.cardCopy;

    try {
        const image = await weatherImage(input.ctx, input.session.userId, result.card, copy, config.cardDesigns);
        const caption = expand(copy.caption, result.card.values, result.card.fragments);

        return { buttons, ...imageReply(image.url, "天气", 540, 850, caption, () => result.text), diagnostics: image.diagnostics };
    } catch (error) {
        const diagnostics = error instanceof CardImageError ? error.diagnostics : errorDetails(error);
        const stage = error instanceof CardImageError ? error.stage : "caption";
        input.ctx.logger.warn("天气图片准备失败，使用文字回复", { ...diagnostics, stage });

        return { buttons, text: result.text, diagnostics: { ...diagnostics, imagePrepareFailed: true, imagePrepareStage: stage } };
    }
}
