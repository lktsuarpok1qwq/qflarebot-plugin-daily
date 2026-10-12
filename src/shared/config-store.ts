import { AdminError, validateInput } from "./admin-errors.js";
import type { PluginDB } from "@qqbot/sdk";
import type { Ctx } from "./types.js";
export type ConfigState<T> = { revision: number; config: T };
export function createConfigStore<T>(options: { table: string; label: string; defaults: () => T; parse: (raw: string) => T; validate: (value: unknown) => T }) {
    if (!/^[a-z][a-z0-9_]*$/.test(options.table)) { throw new Error("配置表名无效"); }

    // Keep the persisted value independent of in-place edits; snapshots are not retained globally.
    const originals = new WeakMap<ConfigState<T>, string>();
    const table = "{" + options.table + "}";
    function decode(row: { revision: number; config: string } | null | undefined): ConfigState<T> {
        if (!row) { throw new Error(options.label + "尚未初始化"); }

        const state = { revision: row.revision, config: options.parse(row.config) };
        originals.set(state, row.config);
        return state;
    }
    return {
        decode,
        async install(ctx: Ctx) {
            await ctx.db.exec(`CREATE TABLE IF NOT EXISTS ${table}(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,config TEXT NOT NULL)`);
            await ctx.db.run(`INSERT OR IGNORE INTO ${table}(id,revision,config) VALUES(1,1,?)`, JSON.stringify(options.defaults()));
        },
        async snapshot(db: PluginDB) {
            return decode(await db.first<{ revision: number; config: string }>(`SELECT revision,config FROM ${table} WHERE id=1`));
        },
        async save(ctx: Ctx, old: ConfigState<T>, value: unknown) {
            const config = validateInput(() => options.validate(value)), serialized = JSON.stringify(config);

            if (serialized === originals.get(old)) { return { revision: old.revision, config }; }

            const result = await ctx.db.run(`UPDATE ${table} SET revision=revision+1,config=? WHERE id=1 AND revision=?`, serialized, old.revision);

            if (!result.changes) { throw new AdminError("conflict", options.label + "配置已变化，请刷新后重试"); }

            return { revision: old.revision + 1, config };
        },
    };
}
