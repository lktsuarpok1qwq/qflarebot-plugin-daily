import type { PluginDB } from "@qqbot/sdk";
import type { Ctx } from "./types.js";
export const SCHEMA_VERSION = 10;
export async function installState(ctx: Ctx, config: object) {
    await ctx.db.exec("CREATE TABLE IF NOT EXISTS {state}(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, bot_id TEXT NOT NULL, config TEXT NOT NULL, token TEXT NOT NULL)");
    await ctx.db.run("INSERT OR IGNORE INTO {state}(id,revision,bot_id,config,token) VALUES (1,1,?,?,?)", ctx.botId, JSON.stringify(config), "initial");
}
export function selectConfig<T>(raw: string, keys: readonly string[]): T {
    const value = JSON.parse(raw);

    if (value?.schemaVersion !== SCHEMA_VERSION) {
        throw new Error("配置格式不受支持");
    }

    return Object.fromEntries(keys.map((key) => [key, value[key]])) as T;
}
export async function readState<T>(db: PluginDB, keys: readonly string[]) {
    const projection = keys.map((key) => `'${key}',json(config -> '$.${key}')`).join(",");
    const row = await db.first<{ revision: number; bot_id: string; config: string }>(`SELECT revision,bot_id,json_object(${projection}) AS config FROM {state} WHERE id=1`);

    if (!row) {
        throw new Error("插件尚未初始化");
    }

    return { revision: row.revision, botId: row.bot_id, config: selectConfig<T>(row.config, keys) };
}
