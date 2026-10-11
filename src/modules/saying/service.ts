import type { Ctx } from "../../shared/types.js";
import { dateAt } from "../../shared/date.js";
import { expand } from "../../shared/interpolation.js";
import { snapshot, cached, publish } from "./repository.js";
import { randomSaying } from "./provider.js";
import type { SayingConfig } from "./config.js";
export function render(config: SayingConfig, text: string) {
    return text ? expand(config.copy.body, { text }) : "";
}
export async function today(ctx: Ctx, at: number, fetcher: typeof fetch = fetch) {
    const day = dateAt(at);
    return (await cached(ctx.db, day)) ?? await publish(ctx.db, day, await randomSaying(fetcher));
}
export function createResolver(ctx: Ctx) {
    let state: ReturnType<typeof snapshot> | undefined;
    const days = new Map<string, Promise<Record<string, string>>>();
    return (at: number) => {
        const day = dateAt(at);

        if (!days.has(day)) {
            days.set(day, (async () => {
                try {
                    state ??= snapshot(ctx.db);
                    const config = (await state).config;
                    return { "一言.今日": render(config, await today(ctx, at)) };
                } catch (error) {
                    ctx.logger.warn("今日一言获取失败", { error: String(error) });
                    return { "一言.今日": "" };
                }
            })());
        }

        return days.get(day)!;
    };
}
