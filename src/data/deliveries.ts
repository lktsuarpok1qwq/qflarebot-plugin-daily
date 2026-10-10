import type { PluginDB, DBStatement } from "@qqbot/sdk";
import type { DeliveryStatus, Due, Plan } from "../types.js";
import { LIMITS } from "../types.js";
import { eventKeys } from "../scheduler/events.js";
import { jsonRows, jx, jsonChunks } from "./sql.js";

export const deliveryKey = (
  d: Pick<Due, "task_id" | "recipient_id" | "due_at"> & { key?: string | null },
) => d.key ?? `${d.task_id}:${d.recipient_id}:${d.due_at}`;

export async function due(db: PluginDB, now: number) {
  // Read all active cursors, so an outage's expired backlog cannot starve live work.
  // Old interrupted manual requests are bounded; subsequent minutes drain them.
  return db.all<Due>(
    `SELECT b.id,b.task_id,b.recipient_id,b.due_at,COALESCE(d.event_key,b.event_key) AS event_key,b.revision,d.status,d.claimed_at,d.key AS key
    FROM {bindings} b LEFT JOIN {deliveries} d ON d.key=b.task_id||':'||b.recipient_id||':'||b.due_at
    WHERE b.enabled=1 AND b.due_at<=?
    UNION ALL
    SELECT CASE WHEN d.key LIKE 'test:%' THEN 'orphan:'||d.key ELSE COALESCE(b.id,'orphan:'||d.key) END AS id,d.task_id,d.recipient_id,d.due_at,d.event_key,d.revision,d.status,d.claimed_at,d.key AS key
    FROM {deliveries} d LEFT JOIN {bindings} b ON b.id=d.task_id||':'||d.recipient_id
    WHERE d.status='sending' AND d.claimed_at<? AND (d.key LIKE 'test:%' OR b.id IS NULL OR b.enabled=0 OR b.due_at IS NULL OR b.due_at<>d.due_at)
    ORDER BY 4 DESC,1 LIMIT ?`,
    now,
    now - 85_000,
    LIMITS.bindings + LIMITS.batch,
  );
}
export type Claim = {
  d: Due;
  status: DeliveryStatus;
  now: number;
  details: unknown;
  error: string | null;
};
export async function claimMany(
  db: PluginDB,
  claims: Claim[],
): Promise<Set<string>> {
  if (!claims.length) return new Set();
  const token = crypto.randomUUID();
  const data = JSON.stringify(
    claims.map((c) => ({
      key: deliveryKey(c.d),
      id: c.d.id,
      due: c.d.due_at,
      revision: c.d.revision,
      status: c.status,
      now: c.now,
      error: c.error,
      details: { ...(c.details as object), claimToken: token },
    })),
  );
  const result = await db.batch<{ key: string }>([
    {
      sql: `${jsonRows} INSERT OR IGNORE INTO {deliveries}(key,task_id,recipient_id,due_at,revision,status,claimed_at,updated_at,details,error,event_key)
      SELECT ${jx("key")},b.task_id,b.recipient_id,b.due_at,b.revision,${jx("status")},${jx("now")},${jx("now")},${jx("details")},${jx("error")},b.event_key
      FROM idx CROSS JOIN input JOIN {bindings} b ON b.id=${jx("id")} JOIN {state} s ON s.id=1
      WHERE b.enabled=1 AND b.due_at=${jx("due")} AND b.revision=${jx("revision")} AND s.revision=b.revision`,
      params: [data],
    },
    {
      sql: `${jsonRows} SELECT d.key FROM idx CROSS JOIN input JOIN {deliveries} d ON d.key=${jx("key")} WHERE json_extract(d.details,'$.claimToken')=?`,
      params: [data, token],
    },
  ]);
  return new Set(result[1]!.results.map((r) => r.key));
}
export async function claim(
  db: PluginDB,
  d: Due,
  status: DeliveryStatus,
  now: number,
  details: unknown,
  error: string | null = null,
) {
  return (await claimMany(db, [{ d, status, now, details, error }])).has(
    deliveryKey(d),
  );
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
  if (!outcomes.length) return;
  const chunks = jsonChunks(
    outcomes.map((o) => ({
      key: deliveryKey(o.d),
      id: o.d.id,
      due: o.d.due_at,
      revision: o.d.revision,
      status: o.status,
      now: o.now,
      next: o.next?.due ?? null,
      event: o.next?.eventKey ?? null,
      error: o.error ?? null,
      messageId: o.messageId ?? null,
    })),
  );
  const records = `${jsonRows}, records AS (SELECT ${["key", "id", "due", "revision", "status", "now", "next", "event", "error", "messageId"].map((k) => `${jx(k)} AS ${k}`).join(",")} FROM idx CROSS JOIN input)`;
  const statements: DBStatement[] = [];
  for (const data of chunks)
    statements.push(
      {
        sql: `${records} UPDATE {deliveries} AS d SET status=(SELECT status FROM records WHERE key=d.key),updated_at=(SELECT now FROM records WHERE key=d.key),error=(SELECT error FROM records WHERE key=d.key),message_id=(SELECT messageId FROM records WHERE key=d.key) WHERE d.status='sending' AND d.key IN (SELECT key FROM records)`,
        params: [data],
      },
      {
        sql: `${records} UPDATE {bindings} AS b SET last_due=MAX(COALESCE(last_due,0),due_at),due_at=(SELECT next FROM records WHERE id=b.id AND due=b.due_at AND revision=b.revision),event_key=(SELECT event FROM records WHERE id=b.id AND due=b.due_at AND revision=b.revision) WHERE EXISTS(SELECT 1 FROM records WHERE id=b.id AND due=b.due_at AND revision=b.revision)`,
        params: [data],
      },
    );
  const events = outcomes.flatMap((o) =>
    o.status === "success" || o.status === "uncertain"
      ? eventKeys(o.d.event_key).map((key) => ({
          id: o.d.id,
          event: key,
          key: deliveryKey(o.d),
        }))
      : [],
  );
  for (const chunk of jsonChunks(events))
    statements.push({
      sql: `${jsonRows} INSERT OR IGNORE INTO {event_progress}(binding_id,event_key) SELECT ${jx("id")},${jx("event")} FROM idx CROSS JOIN input JOIN {deliveries} d ON d.key=${jx("key")} WHERE d.status IN ('success','uncertain')`,
      params: [chunk],
    });
  await db.batch(statements);
}
export async function finish(
  db: PluginDB,
  d: Due,
  status: DeliveryStatus,
  now: number,
  next: Plan | null,
  error: string | null = null,
  messageId: string | null = null,
) {
  await finishMany(db, [{ d, status, now, next, error, messageId }]);
}
