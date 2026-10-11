import type { Ctx } from "../../shared/types.js";
import type { PluginDB } from "@qqbot/sdk";
import type { WeatherConfig, WeatherState } from "./types.js";
import { defaults, validate, parseConfig } from "./config.js";
export async function install(ctx: Ctx) {
    await ctx.db.exec(`
        CREATE TABLE IF NOT EXISTS {weather_state}(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, config TEXT NOT NULL);
    `);
    await ctx.db.run(
        "INSERT OR IGNORE INTO {weather_state}(id,revision,config) VALUES(1,1,?)",
        JSON.stringify(defaults()),
    );
}
function decode(row: { revision: number; config: string } | null | undefined): WeatherState {
    if (!row) {
        throw new Error("天气模块尚未初始化");
    }

    return { revision: row.revision, config: parseConfig(row.config) };
}
export async function snapshot(db: PluginDB) {
    return decode(await db.first<{ revision: number; config: string }>("SELECT revision,config FROM {weather_state} WHERE id=1"));
}
export async function save(ctx: Ctx, old: WeatherState, config: WeatherConfig) {
    validate(config);

    if (JSON.stringify(config) === JSON.stringify(old.config)) {
        return old.revision;
    }

    const result = await ctx.db.run(
        "UPDATE {weather_state} SET revision=revision+1,config=? WHERE id=1 AND revision=?",
        JSON.stringify(config),
        old.revision,
    );

    if (!result.changes) {
        throw new Error("天气配置已变化，请刷新后重试");
    }

    return old.revision + 1;
}
