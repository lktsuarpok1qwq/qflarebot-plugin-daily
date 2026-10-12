import type { PluginDB } from "@qqbot/sdk";
import type { Ctx } from "../../shared/types.js";
import { createConfigStore } from "../../shared/config-store.js";
import { defaults, parseConfig, validate } from "./config.js";
import { SOURCES, type Source, type Cache } from "./types.js";
const store = createConfigStore({ table: "news_state", label: "新闻", defaults, parse: parseConfig, validate });
export const { snapshot, save } = store;
export function readCache(db: PluginDB, sources?: Source[]) {
    if (sources && !sources.length) { return Promise.resolve([] as Cache[]); }

    return db.all<Cache>("SELECT source,items,checked,succeeded,etag,modified,error FROM {news_cache}" + (sources ? " WHERE source IN (" + sources.map(() => "?").join(",") + ")" : ""), ...sources ?? []);
}

export async function install(ctx: Ctx) {
    await store.install(ctx);
    await ctx.db.exec("CREATE TABLE IF NOT EXISTS {news_cache}(source TEXT PRIMARY KEY,items TEXT NOT NULL DEFAULT '[]',checked INTEGER NOT NULL DEFAULT 0,succeeded INTEGER NOT NULL DEFAULT 0,etag TEXT NOT NULL DEFAULT '',modified TEXT NOT NULL DEFAULT '',error TEXT NOT NULL DEFAULT '') WITHOUT ROWID");
    await ctx.db.batch(Object.keys(SOURCES).map((source) => ({ sql: "INSERT OR IGNORE INTO {news_cache}(source) VALUES(?)", params: [source] })));
}
export async function publish(db: PluginDB, old: Cache, next: Cache) {
    const keys = (["items", "checked", "succeeded", "etag", "modified", "error"] as const).filter((key) => old[key] !== next[key]);

    if (!keys.length) { return false; }

    const result = await db.run("UPDATE {news_cache} SET " + keys.map((key) => key + "=?").join(",") + " WHERE source=? AND checked=?", ...keys.map((key) => next[key]), old.source, old.checked);
    return result.changes > 0;
}
