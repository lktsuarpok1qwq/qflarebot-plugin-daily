import type { DBStatement, PluginDB } from "@qqbot/sdk";
import { addDays } from "../../shared/date.js";
import type { Ctx } from "../../shared/types.js";
import { createConfigStore } from "../../shared/config-store.js";
import { defaults, validate, parseConfig } from "./config.js";

const store = createConfigStore({ table: "checkin_state", label: "签到", defaults, validate, parse: parseConfig });
export const save = store.save;
// 金额为零表示签到已完成且不发放 Points 奖励
export type Claim = { bot_id: string; user_id: string; day: string; operation_id: string; amount: number; status: "pending" | "committed" | "rejected" };

export async function install(ctx: Pick<Ctx, "db">) {
    await ctx.db.batch([
        { sql: "CREATE TABLE IF NOT EXISTS {checkin_state}(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,config TEXT NOT NULL)" },
        {
            sql: `CREATE TABLE IF NOT EXISTS {checkin_claims}(bot_id TEXT NOT NULL,user_id TEXT NOT NULL,day TEXT NOT NULL,
            operation_id TEXT NOT NULL,amount INTEGER NOT NULL CHECK(typeof(amount)='integer' AND amount BETWEEN 0 AND 1000000000000),status TEXT NOT NULL CHECK(status IN ('pending','committed','rejected')),
            CHECK(amount>0 OR status='committed'),PRIMARY KEY(bot_id,user_id,day)) WITHOUT ROWID` },
        {
            sql: `CREATE TABLE IF NOT EXISTS {checkin_totals}(bot_id TEXT NOT NULL,user_id TEXT NOT NULL,
            name TEXT NOT NULL,last_day TEXT NOT NULL,total INTEGER NOT NULL CHECK(total>0),streak INTEGER NOT NULL CHECK(streak>0),
            PRIMARY KEY(bot_id,user_id)) WITHOUT ROWID` },
        {
            sql: `CREATE TABLE IF NOT EXISTS {checkin_groups}(bot_id TEXT NOT NULL,group_id TEXT NOT NULL,user_id TEXT NOT NULL,
            PRIMARY KEY(bot_id,group_id,user_id)) WITHOUT ROWID` },
        { sql: "INSERT OR IGNORE INTO {checkin_state}(id,revision,config) VALUES(1,1,?)", params: [JSON.stringify(defaults())] },
    ]);
}

export function snapshot(db: PluginDB) {
    return store.snapshot(db);
}

export type Totals = { name: string; last_day: string; total: number; streak: number };

export async function current(db: PluginDB, bot: string, user: string, detail?: { day: string; group: string }) {
    type Row = { revision: number; config: string; name: string | null; last_day: string | null; total: number | null; streak: number | null; group_seen: string | null } & (Claim | { [K in keyof Claim]: null });
    const group = detail?.group;
    const row = await db.first<Row>(`SELECT s.revision,s.config,${detail ? "c.*" : "NULL AS operation_id"},t.name,t.last_day,t.total,t.streak,
        ${group ? "g.user_id" : "NULL"} AS group_seen FROM {checkin_state} s
        LEFT JOIN {checkin_totals} t ON t.bot_id=?1 AND t.user_id=?2
        ${detail ? "LEFT JOIN {checkin_claims} c ON c.bot_id=?1 AND c.user_id=?2 AND c.day=?3" : ""}
        ${group ? "LEFT JOIN {checkin_groups} g ON g.bot_id=?1 AND g.group_id=?4 AND g.user_id=?2" : ""}
        WHERE s.id=1`, bot, user, ...detail ? [detail.day, ...group ? [group] : []] : []);
    const record: Claim | null = row?.operation_id ? row : null;
    const totals: Totals | null = row?.last_day ? { name: row.name!, last_day: row.last_day, total: row.total!, streak: row.streak! } : null;

    return { config: store.decode(row).config, record, totals, groupSeen: Boolean(row?.group_seen) };
}

export async function attend(db: PluginDB, bot: string, user: string, day: string, name: string, due: { personal: boolean; group: string }, previous: Totals | null) {
    const statements: DBStatement[] = [];

    if (due.personal) {
        statements.push({
            sql: `INSERT INTO {checkin_totals}(bot_id,user_id,name,last_day,total,streak) VALUES(?,?,?,?,1,1)
                ON CONFLICT(bot_id,user_id) DO UPDATE SET name=CASE WHEN excluded.name<>'' THEN excluded.name ELSE name END,last_day=excluded.last_day,total=total+1,
                streak=CASE WHEN last_day=? THEN streak+1 ELSE 1 END WHERE last_day<excluded.last_day RETURNING name,last_day,total,streak`,
            params: [bot, user, name, day, addDays(day, -1)],
        });
    }

    if (due.group) {
        statements.push({
            sql: "INSERT OR IGNORE INTO {checkin_groups}(bot_id,group_id,user_id) VALUES(?,?,?)",
            params: [bot, due.group, user],
        });
    }

    const results = await db.batch<Totals>(statements);

    if (!due.personal) { return previous!; }

    // 常规认领直接使用写回结果，仅并发输家再核对个人计数
    return results[0]!.results[0] ?? await db.first<Totals>("SELECT name,last_day,total,streak FROM {checkin_totals} WHERE bot_id=? AND user_id=?", bot, user);
}

export function ranking(db: PluginDB, bot: string, group: string, limit: number) {
    return db.all<Totals & { user_id: string }>(`SELECT g.user_id,p.name,p.last_day,p.total,p.streak FROM {checkin_groups} g
        JOIN {checkin_totals} p ON p.bot_id=g.bot_id AND p.user_id=g.user_id
        WHERE g.bot_id=? AND g.group_id=? ORDER BY p.total DESC,p.user_id LIMIT ?`, bot, group, limit);
}

export function find(db: PluginDB, bot: string, user: string, day: string) {
    return db.first<Claim>("SELECT * FROM {checkin_claims} WHERE bot_id=? AND user_id=? AND day=?", bot, user, day);
}

export async function claim(db: PluginDB, bot: string, user: string, day: string, amount: number, previous: Claim | null | undefined, status: "pending" | "committed" = "pending"): Promise<Claim | undefined> {
    const row: Claim = { bot_id: bot, user_id: user, day, operation_id: crypto.randomUUID(), amount: status === "committed" ? amount : previous?.amount ?? amount, status };
    const result = previous
        ? await db.run("UPDATE {checkin_claims} SET operation_id=?,amount=?,status=? WHERE bot_id=? AND user_id=? AND day=? AND operation_id=? AND status='rejected'", row.operation_id, row.amount, status, bot, user, day, previous.operation_id)
        : await db.run("INSERT OR IGNORE INTO {checkin_claims}(bot_id,user_id,day,operation_id,amount,status) VALUES(?,?,?,?,?,?)", bot, user, day, row.operation_id, row.amount, status);

    return result.changes ? row : undefined;
}

export async function finish(db: PluginDB, row: Claim, status: "committed" | "rejected") {
    await db.run("UPDATE {checkin_claims} SET status=? WHERE bot_id=? AND user_id=? AND day=? AND operation_id=? AND status='pending'", status, row.bot_id, row.user_id, row.day, row.operation_id);
}
