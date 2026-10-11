import type { PluginDB } from "@qqbot/sdk";
import type { Ctx } from "../../shared/types.js";
import { defaults, validate, parseConfig, type SayingConfig, type SayingState } from "./config.js";
export async function install(ctx: Ctx) {
    await ctx.db.exec(`
        CREATE TABLE IF NOT EXISTS {saying_state}(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, config TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS {saying_cache}(id INTEGER PRIMARY KEY CHECK(id=1), day TEXT NOT NULL, text TEXT NOT NULL);
    `);
    await ctx.db.run("INSERT OR IGNORE INTO {saying_state}(id,revision,config) VALUES(1,1,?)", JSON.stringify(defaults()));
}
function decode(row: { revision: number; config: string } | null | undefined): SayingState {
    if (!row) {
        throw new Error("一言模块尚未初始化");
    }

    return { revision: row.revision, config: parseConfig(row.config) };
}
export async function snapshot(db: PluginDB) {
    return decode(await db.first<{ revision: number; config: string }>("SELECT revision,config FROM {saying_state} WHERE id=1"));
}
export async function dailyState(db: PluginDB, day: string) {
    const row = await db.first<{ revision: number; config: string; text: string | null }>(
        "SELECT s.revision,s.config,c.text FROM {saying_state} s LEFT JOIN {saying_cache} c ON c.id=1 AND c.day=? WHERE s.id=1", day,
    );
    return { ...decode(row), text: row?.text ?? null };
}
export async function save(ctx: Ctx, old: SayingState, config: SayingConfig) {
    validate(config);

    if (JSON.stringify(config) === JSON.stringify(old.config)) {
        return old.revision;
    }

    const result = await ctx.db.run("UPDATE {saying_state} SET revision=revision+1,config=? WHERE id=1 AND revision=?", JSON.stringify(config), old.revision);

    if (!result.changes) {
        throw new Error("一言配置已变化，请刷新后重试");
    }

    return old.revision + 1;
}
export async function cached(db: PluginDB, day: string) {
    return (await db.first<{ text: string }>("SELECT text FROM {saying_cache} WHERE id=1 AND day=?", day))?.text;
}
export async function publish(db: PluginDB, day: string, text: string) {
    // Concurrent first requests all use the first committed result; older dates cannot replace newer ones.
    const rows = await db.batch<{ text: string }>([
        { sql: "INSERT INTO {saying_cache}(id,day,text) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET day=excluded.day,text=excluded.text WHERE day<excluded.day", params: [day, text] },
        { sql: "SELECT text FROM {saying_cache} WHERE id=1 AND day=?", params: [day] },
    ]);
    return rows[1]!.results[0]?.text ?? "";
}
