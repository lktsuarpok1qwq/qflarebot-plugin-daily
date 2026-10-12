import { configAdmin } from "../../shared/admin.js";
import { copyContract, settings } from "./definition.js";
import { snapshot, readCache, save } from "./repository.js";
import { createEvaluator, cutoff } from "./selection.js";
import type { Cache, Article } from "./types.js";
import type { NewsConfig } from "./config.js";
import { sync } from "./sync.js";
function presentCache(cache: Cache[], config: NewsConfig) {
    const evaluate = createEvaluator(config), now = Date.now(), start = cutoff(now);
    return cache.map((row) => ({
        ...row, items: undefined, entries: (JSON.parse(row.items) as Article[]).map((item) => {
            const result = evaluate(item, row.source);
            return { ...result, rejected: item.published < start ? "已过期，等待维护清理" : result.rejected };
        })
    }));
}
export const api = configAdmin({
    label: "新闻", snapshot, save, present: (state) => ({ ...state, cache: null }),
    declaration: () => ({ copyEditor: copyContract.editor, settings }),
    actions: {
        cache: async ({ ctx }) => {
            const [state, cache] = await Promise.all([snapshot(ctx.db), readCache(ctx.db)]);
            return Response.json({ cache: presentCache(cache, state.config) });
        },
        refresh: async ({ ctx }) => {
            const { state, cache } = await sync(ctx, Date.now(), true);
            return Response.json({ cache: presentCache(cache, state.config) });
        },
    },
});
