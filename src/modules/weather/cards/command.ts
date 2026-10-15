import type { CommandInput } from "@qqbot/sdk";
import type { Rendered } from "../../../shared/types.js";
import type { WeatherConfig } from "../types.js";
import { expand } from "../../../shared/interpolation.js";
import { queryWeather } from "../service.js";
import { weatherImage } from "./media.js";
import { WEATHER_CARD_COPY } from "./copy.js";
export async function renderWeatherCommand(input: CommandInput, config: WeatherConfig, fetcher: typeof fetch = fetch): Promise<Rendered> {
    const result = await queryWeather(config, input.args, Date.now(), fetcher, config.imageEnabled !== false);

    if (!result.card) { return result; }

    const copy = config.cardCopy ?? WEATHER_CARD_COPY;

    try {
        const url = await weatherImage(input.ctx, result.card, copy, config.cardDesigns);
        const caption = expand(copy.caption, result.card.values, result.card.fragments);
        const text = `![天气 #540px #850px](${url})${caption ? "\n\n" + caption : ""}`;
        return { text, reply: { markdown: { content: text, forceVerifyImage: true } } };
    } catch {
        return { text: result.text };
    }
}
