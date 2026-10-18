import { analyzeTemplate } from "../../shared/templates.js";
import type { Ctx } from "../../shared/types.js";
import { expand } from "../../shared/interpolation.js";
import { snapshot } from "./repository.js";
import { randomSaying } from "./provider.js";
import type { SayingConfig } from "./config.js";
export function render(config: SayingConfig, key: keyof SayingConfig["copy"], text: string) {
    return text ? expand(config.copy[key], { text }) : "";
}
export async function queryText(ctx: Ctx, key: keyof SayingConfig["copy"]) {
    const { config } = await snapshot(ctx.db);

    if (!analyzeTemplate(config.copy[key]).keys.has("text")) { return config.copy[key]; }

    return render(config, key, await randomSaying());
}
export function createResolver(ctx: Ctx) {
    return async () => {
        try {
            return { "一言.今日": await queryText(ctx, "today") };
        } catch (error) {
            ctx.logger.warn("一言获取失败", { error: String(error) });
            return { "一言.今日": "" };
        }
    };
}
