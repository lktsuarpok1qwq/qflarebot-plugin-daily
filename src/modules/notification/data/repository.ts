import type { Ctx } from "../../../shared/types.js";
import type { DBStatement, PluginDB } from "@qqbot/sdk";
import { type Config, type Snapshot } from "../types.js";
import { readState } from "../../../shared/state.js";
import { CONFIG_KEYS } from "../types.js";
import { nextPlan } from "../scheduler/planner.js";
import { jsonRows, jx, jsonChunks } from "./sql.js";
export const bindingId = (task: string, recipient: string) => `${task}:${recipient}`;
export async function install(ctx: Ctx) {
    await ctx.db.exec(`
    CREATE TABLE IF NOT EXISTS {bindings}(id TEXT PRIMARY KEY, task_id TEXT NOT NULL, recipient_id TEXT NOT NULL, enabled INTEGER NOT NULL, due_at INTEGER, revision INTEGER NOT NULL, last_due INTEGER) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS {due_idx} ON {bindings}(due_at) WHERE enabled=1 AND due_at IS NOT NULL;
    CREATE TABLE IF NOT EXISTS {deliveries}(key TEXT PRIMARY KEY, task_id TEXT NOT NULL, recipient_id TEXT NOT NULL, due_at INTEGER NOT NULL, revision INTEGER NOT NULL, status TEXT NOT NULL, claimed_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, message_id TEXT, error TEXT, details TEXT) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS {logs_pending} ON {deliveries}(claimed_at) WHERE status='sending';
    CREATE INDEX IF NOT EXISTS {logs_time} ON {deliveries}(updated_at);
    CREATE INDEX IF NOT EXISTS {logs_task} ON {deliveries}(task_id,due_at);
    CREATE INDEX IF NOT EXISTS {logs_target} ON {deliveries}(recipient_id,due_at);
    CREATE TABLE IF NOT EXISTS {maintenance}(job TEXT PRIMARY KEY, day TEXT NOT NULL, error TEXT) WITHOUT ROWID;
  `);
}
export async function snapshot(db: PluginDB): Promise<Snapshot> { return readState<Config>(db, CONFIG_KEYS); }
export async function saveConfig(ctx: Ctx, old: Snapshot, config: Config, now: number) {
    const cursors = config.bindings.length ? await ctx.db.all<{
        id: string;
        enabled: number;
        due_at: number | null;
        last_due: number | null;
        schedule: string;
    }>(
        `${jsonRows}, task_idx(i,n) AS (
                SELECT 0,json_array_length(config,'$.tasks') FROM {state} WHERE id=1
                UNION ALL SELECT i+1,n FROM task_idx WHERE i+1<n
            ) SELECT b.id,b.enabled,b.due_at,b.last_due,
            (SELECT json_extract(s.config,'$.tasks['||i||'].schedule') FROM task_idx WHERE i<n AND json_extract(s.config,'$.tasks['||i||'].id')=b.task_id) AS schedule
            FROM {bindings} b CROSS JOIN {state} s WHERE s.id=1 AND b.id IN (SELECT ${jx("id")} FROM idx CROSS JOIN input)`,
        JSON.stringify(config.bindings.map((b) => ({ id: bindingId(b.taskId, b.recipientId) }))),
    ) : [];
    const byId = new Map(cursors.map((x) => [x.id, x])),
        rows: { id: string; task_id: string; recipient_id: string; enabled: number; due_at: number | null; preserve: number; changed: number }[] = [];

    for (const b of config.bindings) {
        const id = bindingId(b.taskId, b.recipientId),
            task = config.tasks.find((t) => t.id === b.taskId)!,
            r = config.recipients.find((r) => r.id === b.recipientId)!,
            previous = byId.get(id);
        const enabled = !config.paused && task.enabled && r.enabled && r.botId === ctx.botId;
        const sameSchedule = previous?.schedule === JSON.stringify(task.schedule);
        const preserve =
            enabled &&
            previous?.enabled &&
            previous.due_at !== null &&
            sameSchedule &&
            old.botId === ctx.botId;
        const plan = enabled
            ? preserve
                ? { due: previous.due_at }
                : nextPlan(task.schedule, Math.max(now, previous?.last_due ?? 0))
            : null;
        rows.push({
            id,
            task_id: task.id,
            recipient_id: r.id,
            enabled: enabled ? 1 : 0,
            due_at: plan?.due ?? null,
            preserve: preserve ? 1 : 0,
            changed: sameSchedule && old.botId === ctx.botId ? 0 : 1,
        });
    }

    const rev = old.revision + 1, token = crypto.randomUUID();
    const gate = { sql: "EXISTS(SELECT 1 FROM {state} WHERE token=?)", params: [token] };
    const statements: DBStatement[] = [{
        sql: "UPDATE {state} SET revision=?,bot_id=?,config=json_patch(config,?),token=? WHERE id=1 AND revision=?",
        params: [rev, ctx.botId, JSON.stringify(config), token, old.revision],
    }, {
        sql: `${jsonRows} UPDATE {bindings} SET enabled=0,due_at=NULL,revision=? WHERE enabled=1 AND id NOT IN (SELECT ${jx("id")} FROM idx CROSS JOIN input) AND (${gate.sql})`,
        params: [JSON.stringify(rows.map(({ id }) => ({ id }))), rev, ...gate.params],
    }];

    for (const chunk of jsonChunks(rows)) {
        statements.push({
            sql: `${jsonRows} INSERT INTO {bindings}(id,task_id,recipient_id,enabled,due_at,revision)
                SELECT ${["id", "task_id", "recipient_id", "enabled", "due_at"].map(jx).join(",")},? FROM idx CROSS JOIN input WHERE (${gate.sql})
                ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,due_at=CASE WHEN (SELECT ${jx("preserve")} FROM idx CROSS JOIN input WHERE ${jx("id")}=excluded.id)=1 THEN due_at ELSE excluded.due_at END,revision=excluded.revision
                WHERE enabled<>excluded.enabled
                    OR (due_at IS NOT excluded.due_at AND (SELECT ${jx("preserve")} FROM idx CROSS JOIN input WHERE ${jx("id")}=excluded.id)=0)
                    OR (SELECT ${jx("changed")} FROM idx CROSS JOIN input WHERE ${jx("id")}=excluded.id)=1`,
            params: [chunk, rev, ...gate.params],
        });
    }

    const result = await ctx.db.batch(statements);

    if (!result[0]?.changes) { throw new Error("配置已变化，请刷新后重试"); }

    return rev;
}
