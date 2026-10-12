import { querySearch } from "./search.js";
import type { Ctx } from "../../shared/types.js";
import { expand, commandUrl } from "../../shared/interpolation.js";
import { snapshot, readCache } from "./repository.js";
import { document } from "./selection.js";
import { renderNews } from "./rendering.js";
import { SOURCES, type Source, type Mode } from "./types.js";
export async function command(ctx: Ctx, name: string, args: string[]) {
    const { config } = await snapshot(ctx.db);

    if (name === "新闻") { return { text: renderNews(config.copy, { kind: "help" }, expand, commandUrl) }; }

    if (name === "新闻 搜") { return querySearch(config.search, args); }

    const mode = (name === "新闻 游戏" ? "今日" : name.slice("新闻 游戏 ".length)) as Mode;
    const page = args.length ? Number(args[0]) : 1;

    if (args.length > 1 || args.length && !/^[1-9]\d*$/.test(args[0]!) || !Number.isSafeInteger(page)) { return { text: renderNews(config.copy, { kind: "invalid" }, expand, commandUrl) }; }

    if (!config.copy.body) { return { text: "" }; }

    const result = document(config, await readCache(ctx.db, (Object.keys(SOURCES) as Source[]).filter((source) => config[source])), mode, page, Date.now());
    return { text: renderNews(config.copy, result, expand, commandUrl) };
}
export function createResolver(ctx: Ctx) {
    let state: ReturnType<typeof snapshot> | undefined, cache: ReturnType<typeof readCache> | undefined;
    return async (now: number) => {
        state ??= snapshot(ctx.db);
        const { config } = await state;

        if (!config.copy.body) { return { "新闻.游戏": "" }; }

        cache ??= readCache(ctx.db, (Object.keys(SOURCES) as Source[]).filter((source) => config[source]));
        const result = document(config, await cache, "今日", 1, now);
        return { "新闻.游戏": result.kind === "list" ? renderNews(config.copy, result, expand, commandUrl) : "" };
    };
}
