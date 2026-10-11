import type { Ctx, RestorePart } from "../../shared/types.js";
import type { PluginDB } from "@qqbot/sdk";
import type { WeatherConfig, WeatherState } from "./types.js";
import { defaults, validate } from "./config.js";
export async function install(ctx: Ctx) {
    await ctx.db.exec(`
        CREATE TABLE IF NOT EXISTS {weather_state}(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, config TEXT NOT NULL);
    `);
    await ctx.db.run(
        "INSERT OR IGNORE INTO {weather_state}(id,revision,config) VALUES(1,1,?)",
        JSON.stringify(defaults()),
    );
}
const read = [{ sql: "SELECT revision,config FROM {weather_state} WHERE id=1" }];
function decode(row: { revision: number; config: string } | null | undefined): WeatherState {
    if (!row) {
        throw new Error("天气模块尚未初始化");
    }

    return { revision: row.revision, config: validate(JSON.parse(row.config)) };
}
export async function snapshot(db: PluginDB) {
    return decode(await db.first<{ revision: number; config: string }>(read[0]!.sql));
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
export const backup = {
    read,
    decode(rows: { results: unknown[] }[]) {
        const state = decode(rows[0]?.results[0] as Parameters<typeof decode>[0]);
        // Credentials stay on the current installation, including during backup restore.
        return { revision: state.revision, data: { ...state.config, apiKey: "" } };
    },
    async validate(value: unknown) {
        const config = validate(value);

        if (config.apiKey) {
            throw new Error("天气备份不能包含密钥");
        }
    },
    restore(value: unknown, revision: number): RestorePart {
        const config = validate(value);
        return {
            guard: { sql: "EXISTS(SELECT 1 FROM {weather_state} WHERE id=1 AND revision=?)", params: [revision] },
            statements: (gate) => [
                {
                    sql: `UPDATE {weather_state} SET revision=revision+1,config=json_set(?, '$.apiKey', CASE WHEN json_extract(config,'$.host')=? THEN json_extract(config,'$.apiKey') ELSE '' END) WHERE id=1 AND (${gate.sql})`,
                    params: [JSON.stringify(config), config.host, ...(gate.params ?? [])],
                },
            ],
        };
    },
};
