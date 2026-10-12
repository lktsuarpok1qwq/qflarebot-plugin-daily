import type { PluginDB } from "@qqbot/sdk";
import type { Ctx } from "../../shared/types.js";
import { createConfigStore } from "../../shared/config-store.js";
import { defaults, validate, parseConfig } from "./config.js";
const store = createConfigStore({ table: "saying_state", label: "一言", defaults, parse: parseConfig, validate });
export const { snapshot, save } = store;
export async function install(ctx: Ctx) {
    await store.install(ctx);
    await ctx.db.exec("CREATE TABLE IF NOT EXISTS {saying_cache}(id INTEGER PRIMARY KEY CHECK(id=1), day TEXT NOT NULL, text TEXT NOT NULL)");
}
export async function dailyState(db: PluginDB, day: string) {
    const row = await db.first<{ revision: number; config: string; text: string | null }>(
        "SELECT s.revision,s.config,c.text FROM {saying_state} s LEFT JOIN {saying_cache} c ON c.id=1 AND c.day=? WHERE s.id=1", day,
    );
    return { ...store.decode(row), text: row?.text ?? null };
}
export async function publish(db: PluginDB, day: string, text: string) {
    // Concurrent first requests all use the first committed result; older dates cannot replace newer ones.
    const rows = await db.batch<{ text: string }>([
        { sql: "INSERT INTO {saying_cache}(id,day,text) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET day=excluded.day,text=excluded.text WHERE day<excluded.day", params: [day, text] },
        { sql: "SELECT text FROM {saying_cache} WHERE id=1 AND day=?", params: [day] },
    ]);
    return rows[1]!.results[0]?.text ?? "";
}
