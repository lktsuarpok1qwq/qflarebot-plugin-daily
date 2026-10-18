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
export async function dailyText(ctx: Ctx, at: number, key: keyof SayingConfig["copy"]) {
    const day = dateAt(at), { config, text } = await dailyState(ctx.db, day);

    if (!analyzeTemplate(config.copy[key]).keys.has("text")) { return config.copy[key]; }

    const content = text ?? await publish(ctx.db, day, await randomSaying());
    return render(config, key, content);
}
export function createResolver(ctx: Ctx) {
    const days = new Map<string, Promise<Record<string, string>>>();
    return (at: number) => {
        const day = dateAt(at);

        if (!days.has(day)) {
            days.set(day, (async () => {
                try {
                    return { "一言.今日": await dailyText(ctx, at, "today") };
                } catch (error) {
                    ctx.logger.warn("今日一言获取失败", { error: String(error) });
                    return { "一言.今日": "" };
                }
            })());
        }

        return days.get(day)!;
    };
}
