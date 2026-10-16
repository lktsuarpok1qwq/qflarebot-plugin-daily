import { analyzeTemplate } from "../../shared/templates.js";
import type { Ctx } from "../../shared/types.js";
import { dateAt } from "../../shared/date.js";
import { expand } from "../../shared/interpolation.js";
import { dailyState, publish } from "./repository.js";
import { randomSaying } from "./provider.js";
import type { SayingConfig } from "./config.js";
export function render(config: SayingConfig, key: keyof SayingConfig["copy"], text: string) {
    return text ? expand(config.copy[key], { text }) : "";
}
export function createResolver(ctx: Ctx) {
    const days = new Map<string, Promise<Record<string, string>>>();
    return (at: number) => {
        const day = dateAt(at);

        if (!days.has(day)) {
            days.set(day, (async () => {
                try {
                    const { config, text } = await dailyState(ctx.db, day);

                    if (!analyzeTemplate(config.copy.today).keys.has("text")) {
                        return { "一言.今日": config.copy.today };
                    }

                    const content = text ?? await publish(ctx.db, day, await randomSaying());
                    return { "一言.今日": render(config, "today", content) };
                } catch (error) {
                    ctx.logger.warn("今日一言获取失败", { error: String(error) });
                    return { "一言.今日": "" };
                }
            })());
        }

        return days.get(day)!;
    };
}
