import type { PluginDB } from "@qqbot/sdk";
import type { Ctx } from "../../shared/types.js";
import { createConfigStore } from "../../shared/config-store.js";
import { defaults, validate, parseConfig } from "./config.js";
const store = createConfigStore({ table: "checkin_state", label: "签到", defaults, validate, parse: parseConfig });
export const save = store.save;
// Zero amount represents a completed sign-in without a Points reward.
export type Claim = { bot_id: string; user_id: string; day: string; operation_id: string; amount: number; status: "pending" | "committed" | "rejected" };
export async function install(ctx: Pick<Ctx, "db">) {
    await ctx.db.batch([
        { sql: "CREATE TABLE IF NOT EXISTS {checkin_state}(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,config TEXT NOT NULL)" },
        {
            sql: `CREATE TABLE IF NOT EXISTS {checkin_claims}(bot_id TEXT NOT NULL,user_id TEXT NOT NULL,day TEXT NOT NULL,
            operation_id TEXT NOT NULL,amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount BETWEEN 0 AND 1000000000000),status TEXT NOT NULL CHECK(status IN ('pending','committed','rejected')),
            CHECK(amount>0 OR status='committed'),PRIMARY KEY(bot_id,user_id,day)) WITHOUT ROWID` },
        { sql: "INSERT OR IGNORE INTO {checkin_state}(id,revision,config) VALUES(1,1,?)", params: [JSON.stringify(defaults())] },
    ]);
}
async function initialized<T>(db: PluginDB, read: () => Promise<T>): Promise<T> {
    try { return await read(); } catch (error) {
        if (!(error instanceof Error) || !["checkin_state", "checkin_claims"].some(table => error.message.includes("no such table: " + db.table(table)))) { throw error; }

        // Module tables are initialized on first use; no existing module data is changed.
        await install({ db });
        return read();
    }
}
export function snapshot(db: PluginDB) {
    return initialized(db, () => store.snapshot(db));
}
export async function current(db: PluginDB, bot: string, user: string, day: string) {
    type Row = { revision: number; config: string } & (Claim | { [K in keyof Claim]: null });
    const row = await initialized(db, () => db.first<Row>(`SELECT s.revision,s.config,c.* FROM {checkin_state} s
        LEFT JOIN {checkin_claims} c ON c.bot_id=? AND c.user_id=? AND c.day=? WHERE s.id=1`, bot, user, day));
    const record: Claim | null = row?.operation_id ? row : null;
    return { config: store.decode(row).config, record };
}
export function find(db: PluginDB, bot: string, user: string, day: string) {
    return db.first<Claim>("SELECT * FROM {checkin_claims} WHERE bot_id=? AND user_id=? AND day=?", bot, user, day);
}
export async function claim(db: PluginDB, bot: string, user: string, day: string, amount: number, previous: Claim | null | undefined, status: "pending" | "committed" = "pending"): Promise<Claim | undefined> {
    const row: Claim = { bot_id: bot, user_id: user, day, operation_id: crypto.randomUUID(), amount, status };
    const result = previous
        ? await db.run("UPDATE {checkin_claims} SET operation_id=?,amount=?,status=? WHERE bot_id=? AND user_id=? AND day=? AND operation_id=? AND status='rejected'", row.operation_id, row.amount, status, bot, user, day, previous.operation_id)
        : await db.run("INSERT OR IGNORE INTO {checkin_claims}(bot_id,user_id,day,operation_id,amount,status) VALUES(?,?,?,?,?,?)", bot, user, day, row.operation_id, row.amount, status);
    return result.changes ? row : undefined;
}
export async function finish(db: PluginDB, row: Claim, status: "committed" | "rejected") {
    await db.run("UPDATE {checkin_claims} SET status=? WHERE bot_id=? AND user_id=? AND day=? AND operation_id=? AND status='pending'", status, row.bot_id, row.user_id, row.day, row.operation_id);
}
