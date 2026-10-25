import { analyzeTemplate } from "../../shared/templates.js";
import type { Ctx } from "../../shared/types.js";
import { expand } from "../../shared/interpolation.js";
import { snapshot } from "./repository.js";
import { randomSaying } from "./provider.js";
import type { SayingConfig } from "./config.js";

export function render(config: SayingConfig, key: keyof SayingConfig["copy"], text: string) {
    return text ? expand(config.copy[key], { text }) : "";
}

export async function queryReply(ctx: Ctx, key: keyof SayingConfig["copy"]) {
    const { config } = await snapshot(ctx.db);
    const text = analyzeTemplate(config.copy[key]).keys.has("text") ? render(config, key, await randomSaying()) : config.copy[key];

    return { text, buttons: key === "body" ? config.buttons?.command : undefined };
}

export function createResolver(ctx: Ctx) {
    return async () => {
        try {
            return { "一言.今日": (await queryReply(ctx, "today")).text };
        } catch (error) {
            ctx.logger.warn("一言获取失败", { error: String(error) });

            return { "一言.今日": "" };
        }
    };
}
