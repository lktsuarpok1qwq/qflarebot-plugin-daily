import type { Ctx } from "../shared/types.js";
import { readState, SCHEMA_VERSION } from "../shared/state.js";
import { CONFIG_KEYS, type Config } from "../types.js";
import { COPY } from "../copy.js";
import type { PluginDB } from "@qqbot/sdk";
export const defaults = (): Config => ({ schemaVersion: SCHEMA_VERSION, replies: structuredClone(COPY.replies), commandFeedback: structuredClone(COPY.commandFeedback) });
// Core copy uses its current value as an optimistic revision; notification revisions and cursors stay untouched.
async function revisionOf(config: Config) {
    const values = [config.schemaVersion, config.replies.每日.body, config.commandFeedback.error, config.commandFeedback.tooLong];
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(values)));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function snapshot(db: PluginDB) {
    const state = await readState<Config>(db, CONFIG_KEYS);
    return { ...state, revision: await revisionOf(state.config) };
}
export async function readConfig(db: PluginDB): Promise<Config> {
    return (await readState<Config>(db, CONFIG_KEYS)).config;
}
function configGuard(c: Config) {
    return { sql: "json_extract(config,'$.replies')=? AND json_extract(config,'$.commandFeedback')=?", params: [JSON.stringify(c.replies), JSON.stringify(c.commandFeedback)] };
}
export async function saveConfig(ctx: Ctx, old: Awaited<ReturnType<typeof snapshot>>, config: Config) {
    const guard = configGuard(old.config);
    const result = await ctx.db.run("UPDATE {state} SET config=json_patch(config,?) WHERE id=1 AND " + guard.sql, JSON.stringify(config), ...guard.params);

    if (!result.changes) { throw new Error("配置已变化，请刷新"); }

    return revisionOf(config);
}
