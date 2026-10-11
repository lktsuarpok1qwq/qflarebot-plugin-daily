import type { PluginDB } from "@qqbot/sdk";
import type { Ctx, RestorePart } from "../../shared/types.js";
import { defaults, validate, type SayingConfig, type SayingState } from "./config.js";
export async function install(ctx: Ctx) {
    await ctx.db.exec(`
        CREATE TABLE IF NOT EXISTS {saying_state}(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, config TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS {saying_cache}(id INTEGER PRIMARY KEY CHECK(id=1), day TEXT NOT NULL, text TEXT NOT NULL);
    `);
    await ctx.db.run("INSERT OR IGNORE INTO {saying_state}(id,revision,config) VALUES(1,1,?)", JSON.stringify(defaults()));
}
const read = [{ sql: "SELECT revision,config FROM {saying_state} WHERE id=1" }];
function decode(row: { revision: number; config: string } | null | undefined): SayingState {
    if (!row) {
        throw new Error("一言模块尚未初始化");
    }

    return { revision: row.revision, config: validate(JSON.parse(row.config)) };
}
export async function snapshot(db: PluginDB) {
    return decode(await db.first<{ revision: number; config: string }>(read[0]!.sql));
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
export const backup = {
    read,
    decode(rows: { results: unknown[] }[]) {
        const state = decode(rows[0]?.results[0] as Parameters<typeof decode>[0]);
        return { revision: state.revision, data: state.config };
    },
    async validate(value: unknown) {
        validate(value);
    },
    restore(value: unknown, revision: number): RestorePart {
        const config = validate(value);
        return {
            guard: { sql: "EXISTS(SELECT 1 FROM {saying_state} WHERE id=1 AND revision=?)", params: [revision] },
            statements: (gate) => [{ sql: `UPDATE {saying_state} SET revision=revision+1,config=? WHERE id=1 AND (${gate.sql})`, params: [JSON.stringify(config), ...(gate.params ?? [])] }],
        };
    },
};
