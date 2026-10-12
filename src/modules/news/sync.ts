import type { Ctx } from "../../shared/types.js";
import { snapshot, readCache, publish } from "./repository.js";
import { fetchSource } from "./provider.js";
import { mergeArticles } from "./selection.js";
import type { Article } from "./types.js";
export async function sync(ctx: Ctx, now = Date.now(), manual = false, request: typeof fetch = fetch) {
    const [state, cache] = await Promise.all([snapshot(ctx.db), readCache(ctx.db)]);
    let conflict = false;
    const updated = await Promise.all(cache.map(async (old) => {
        // Repeated scheduler invocations in the same hour reuse the recorded result.
        if (old.checked >= now || !manual && Math.floor(old.checked / 3_600_000) >= Math.floor(now / 3_600_000)) { return old; }

        const previous = JSON.parse(old.items) as Article[];
        let incoming: Article[] = [];
        const next = { ...old, checked: now };

        if (state.config[old.source]) {
            try {
                const result = await fetchSource(old.source, old, request);

                if (!result.unchanged) {
                    incoming = result.items;
                    next.etag = result.etag; next.modified = result.modified;
                }

                next.succeeded = now; next.error = "";
            } catch (error) {
                next.error = error instanceof Error ? error.message : "采集失败";
                ctx.logger.warn("游戏新闻采集失败", { source: old.source, error: next.error });
            }
        }

        next.items = JSON.stringify(mergeArticles(previous, incoming, now));

        if (!state.config[old.source] && old.items === next.items) { return old; }

        if (!await publish(ctx.db, old, next)) { conflict = true; }

        return next;
    }));
    return { state, cache: conflict ? await readCache(ctx.db) : updated };
}
