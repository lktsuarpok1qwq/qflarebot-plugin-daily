import type { PluginDB, DBStatement } from "@qqbot/sdk";
import type { DeliveryStatus, Due, Plan } from "../types.js";
import { LIMITS } from "../types.js";
import { jsonRows, jx, jsonChunks } from "./sql.js";

export const deliveryKey = (d: Pick<Due, "task_id" | "recipient_id" | "due_at"> & { key?: string | null }) =>
    d.key ?? `${d.task_id}:${d.recipient_id}:${d.due_at}`;

export async function due(db: PluginDB, now: number) {
    // Read all active cursors, so an outage's expired backlog cannot starve live work.
    // Old interrupted manual requests are bounded; subsequent minutes drain them.
    return db.all<Due>(
        `SELECT b.id,b.task_id,b.recipient_id,b.due_at,b.revision,d.status,d.claimed_at,d.key AS key
    FROM {bindings} b LEFT JOIN {deliveries} d ON d.key=b.task_id||':'||b.recipient_id||':'||b.due_at
    WHERE b.enabled=1 AND b.due_at<=?
    UNION ALL
    SELECT CASE WHEN d.key LIKE 'test:%' THEN 'orphan:'||d.key ELSE COALESCE(b.id,'orphan:'||d.key) END AS id,d.task_id,d.recipient_id,d.due_at,d.revision,d.status,d.claimed_at,d.key AS key
    FROM {deliveries} d LEFT JOIN {bindings} b ON b.id=d.task_id||':'||d.recipient_id
    WHERE d.status='sending' AND d.claimed_at<? AND (d.key LIKE 'test:%' OR b.id IS NULL OR b.enabled=0 OR b.due_at IS NULL OR b.due_at<>d.due_at)
    ORDER BY 4 DESC,1 LIMIT ?`,
        now,
        now - 85_000,
        LIMITS.bindings * 2,
    );
}
export type Claim = {
    d: Due;
    status: DeliveryStatus;
    now: number;
    details: unknown;
    error: string | null;
};
// Configuration guards the rendered snapshot; binding revisions guard each schedule.
export async function claimMany(db: PluginDB, claims: Claim[], configRevision: number): Promise<Set<string>> {
    if (!claims.length) {
        return new Set();
    }

    const chunks = jsonChunks(
        claims.map((c) => ({
            key: deliveryKey(c.d),
            id: c.d.id,
            due: c.d.due_at,
            revision: c.d.revision,
            status: c.status,
            now: c.now,
            error: c.error,
            details: c.details,
        })),
        1_900_000,
    );
    // D1 limits each bound value to 2 MB; all chunks share one atomic claim transaction.
    const result = await db.batch<{ key: string }>(chunks.map((data) => ({
        sql: `${jsonRows} INSERT OR IGNORE INTO {deliveries}(key,task_id,recipient_id,due_at,revision,status,claimed_at,updated_at,details,error)
      SELECT ${jx("key")},b.task_id,b.recipient_id,b.due_at,b.revision,${jx("status")},${jx("now")},${jx("now")},${jx("details")},${jx("error")}
      FROM idx CROSS JOIN input JOIN {bindings} b ON b.id=${jx("id")} JOIN {notification_state} s ON s.id=1
      WHERE b.enabled=1 AND b.due_at=${jx("due")} AND b.revision=${jx("revision")} AND s.revision=? RETURNING key`,
        params: [data, configRevision],
    })));
    return new Set(result.flatMap((chunk) => chunk.results.map((r) => r.key)));
}
export type Outcome = {
    d: Due;
    status: DeliveryStatus;
    now: number;
    next: Plan | null;
    error?: string | null;
    messageId?: string | null;
};
export async function finishMany(db: PluginDB, outcomes: Outcome[]) {
    if (!outcomes.length) {
        return;
    }

    const chunks = jsonChunks(
        outcomes.map((o) => ({
            key: deliveryKey(o.d),
            id: o.d.id,
            due: o.d.due_at,
            revision: o.d.revision,
            status: o.status,
            now: o.now,
            next: o.next?.due ?? null,
            error: o.error ?? null,
            messageId: o.messageId ?? null,
        })),
    );
    // Materialize parsed outcomes once per statement; correlated lookups reuse the rows.
    const records = `${jsonRows}, records AS MATERIALIZED (SELECT ${["key", "id", "due", "revision", "status", "now", "next", "error", "messageId"].map((k) => `${jx(k)} AS ${k}`).join(",")} FROM idx CROSS JOIN input)`;
    const statements: DBStatement[] = [];

    for (const data of chunks) {
        statements.push(
            {
                sql: `${records} UPDATE {deliveries} AS d SET (status,updated_at,error,message_id)=(SELECT status,now,error,messageId FROM records WHERE key=d.key) WHERE d.status='sending' AND d.key IN (SELECT key FROM records)`,
                params: [data],
            },
            {
                sql: `${records} UPDATE {bindings} AS b SET last_due=MAX(COALESCE(last_due,0),due_at),due_at=(SELECT next FROM records WHERE id=b.id AND due=b.due_at AND revision=b.revision) WHERE b.id IN (SELECT id FROM records) AND EXISTS(SELECT 1 FROM records WHERE id=b.id AND due=b.due_at AND revision=b.revision)`,
                params: [data],
            },
        );
    }

    await db.batch(statements);
}
