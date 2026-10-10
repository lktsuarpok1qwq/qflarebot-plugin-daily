import { SOURCE_QUERY } from "../modules/holiday/source.js";
import type { DBStatement, PluginDB } from "@qqbot/sdk";
import {
  SCHEMA_VERSION,
  type Config,
  type Ctx,
  type Snapshot,
  type Source,
} from "../types.js";
import { defaults } from "../content/templates.js";
import { refreshHolidays } from "../modules/holiday/calendar.js";
import { nextPlan, dateAt } from "../scheduler/planner.js";
import { jsonRows, jx, jsonChunks } from "./sql.js";
export { deliveryKey, due, claim } from "./deliveries.js";
export const bindingId = (task: string, recipient: string) =>
  `${task}:${recipient}`;
export async function install(ctx: Ctx) {
  await ctx.db.exec(`
    CREATE TABLE IF NOT EXISTS {state}(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, bot_id TEXT NOT NULL, config TEXT NOT NULL, token TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS {bindings}(id TEXT PRIMARY KEY, task_id TEXT NOT NULL, recipient_id TEXT NOT NULL, enabled INTEGER NOT NULL, due_at INTEGER, revision INTEGER NOT NULL, last_due INTEGER);
    CREATE INDEX IF NOT EXISTS {due_idx} ON {bindings}(enabled,due_at);
    CREATE TABLE IF NOT EXISTS {deliveries}(key TEXT PRIMARY KEY, task_id TEXT NOT NULL, recipient_id TEXT NOT NULL, due_at INTEGER NOT NULL, revision INTEGER NOT NULL, status TEXT NOT NULL, claimed_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, message_id TEXT, error TEXT, details TEXT);
    CREATE INDEX IF NOT EXISTS {logs_pending} ON {deliveries}(status,claimed_at);
    CREATE INDEX IF NOT EXISTS {logs_time} ON {deliveries}(updated_at);
    CREATE INDEX IF NOT EXISTS {logs_task} ON {deliveries}(task_id,due_at);
    CREATE INDEX IF NOT EXISTS {logs_target} ON {deliveries}(recipient_id,due_at);
    CREATE TABLE IF NOT EXISTS {sources}(year INTEGER PRIMARY KEY, hash TEXT NOT NULL, data TEXT NOT NULL, error TEXT, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS {maintenance}(job TEXT PRIMARY KEY, day TEXT NOT NULL, error TEXT);
  `);
  await ctx.db.run(
    "INSERT OR IGNORE INTO {state}(id,revision,bot_id,config,token) VALUES (1,1,?,?,?)",
    ctx.botId,
    JSON.stringify(defaults()),
    "initial",
  );
}
/** Refresh cached calendar views and remove completed past years. */
export async function refreshCalendar(ctx: Ctx, now = Date.now()) {
  const { snapshot: s, sources: current } = await readData(ctx.db);
  const config = structuredClone(s.config);
  refreshHolidays(config, current, now);
  if (JSON.stringify(config) !== JSON.stringify(s.config))
    await saveConfig(ctx, s, config, now);
  const year = +dateAt(now).slice(0, 4);
  if (current.some((source) => source.year < year || source.year > year + 1))
    await ctx.db.batch([
      {
        sql: "DELETE FROM {maintenance} WHERE job IN (SELECT 'holiday:' || year FROM {sources} WHERE year<? OR year>?)",
        params: [year, year + 1],
      },
      {
        sql: "DELETE FROM {sources} WHERE year<? OR year>?",
        params: [year, year + 1],
      },
    ]);
  return config;
}
function parseConfig(raw: string): Config {
  const config = JSON.parse(raw) as Config | null;
  if (config?.schemaVersion !== SCHEMA_VERSION)
    throw new Error("配置格式不受支持，请清理插件数据后重新安装");
  return config;
}
export async function snapshot(db: PluginDB): Promise<Snapshot> {
  const s = await db.first<{
    revision: number;
    bot_id: string;
    config: string;
  }>("SELECT revision,bot_id,config FROM {state} WHERE id=1");
  if (!s) throw new Error("插件尚未初始化");
  return {
    revision: s.revision,
    botId: s.bot_id,
    config: parseConfig(s.config),
  };
}
/** Configuration and raw sources must be from the same publication transaction. */
export async function readData(
  db: PluginDB,
): Promise<{ snapshot: Snapshot; sources: Source[] }> {
  const rows = await db.batch([
    { sql: "SELECT revision,bot_id,config FROM {state} WHERE id=1" },
    { sql: SOURCE_QUERY },
  ]);
  const state = rows[0]!.results[0] as
    { revision: number; bot_id: string; config: string } | undefined;
  if (!state) throw new Error("插件尚未初始化");
  return {
    snapshot: {
      revision: state.revision,
      botId: state.bot_id,
      config: parseConfig(state.config),
    },
    sources: rows[1]!.results as Source[],
  };
}
export async function saveConfig(
  ctx: Ctx,
  old: Snapshot,
  config: Config,
  now: number,
  restore = false,
  restored?: {
    sources: Source[];
  },
  publishedSource?: Source,
) {
  const year = +dateAt(now).slice(0, 4);
  config.holidays = config.holidays.filter((h) => h.end >= `${year}-01-01`);
  const cursors = await ctx.db.all<{
    id: string;
    enabled: number;
    due_at: number | null;
    last_due: number | null;
  }>(
    `${jsonRows} SELECT id,enabled,due_at,last_due FROM {bindings} WHERE id IN (SELECT ${jx("id")} FROM idx CROSS JOIN input)`,
    JSON.stringify(
      config.bindings.map((b) => ({ id: bindingId(b.taskId, b.recipientId) })),
    ),
  );
  const byId = new Map(cursors.map((x) => [x.id, x])),
    rows = [];
  for (const b of config.bindings) {
    const id = bindingId(b.taskId, b.recipientId),
      task = config.tasks.find((t) => t.id === b.taskId)!,
      r = config.recipients.find((r) => r.id === b.recipientId)!,
      previous = byId.get(id);
    const enabled =
      !config.paused &&
      task.enabled &&
      r.enabled &&
      b.enabled &&
      r.botId === ctx.botId;
    const oldTask = old.config.tasks.find((t) => t.id === task.id);
    const sameSchedule =
      JSON.stringify(oldTask?.schedule) === JSON.stringify(task.schedule);
    const preserve =
      !restore &&
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
    });
  }
  const token = crypto.randomUUID(),
    rev = old.revision + 1;
  const statements: DBStatement[] = [
    {
      sql: "UPDATE {state} SET revision=?,bot_id=?,config=?,token=? WHERE id=1 AND revision=? AND (?=0 OR NOT EXISTS(SELECT 1 FROM {deliveries} WHERE status='sending'))",
      params: [
        rev,
        ctx.botId,
        JSON.stringify(config),
        token,
        old.revision,
        restore ? 1 : 0,
      ],
    },
    {
      sql: `${jsonRows} UPDATE {bindings} SET enabled=0,due_at=NULL,revision=? WHERE enabled=1 AND id NOT IN (SELECT ${jx("id")} FROM idx CROSS JOIN input) AND EXISTS(SELECT 1 FROM {state} WHERE token=?)`,
      params: [JSON.stringify(rows.map(({ id }) => ({ id }))), rev, token],
    },
  ];
  for (const chunk of jsonChunks(rows))
    statements.push({
      sql: `${jsonRows} INSERT INTO {bindings}(id,task_id,recipient_id,enabled,due_at,revision)
      SELECT ${["id", "task_id", "recipient_id", "enabled", "due_at"].map(jx).join(",")},?
      FROM idx CROSS JOIN input WHERE EXISTS(SELECT 1 FROM {state} WHERE token=?)
      ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,due_at=CASE WHEN (SELECT ${jx("preserve")} FROM idx CROSS JOIN input WHERE ${jx("id")}=excluded.id)=1 THEN due_at ELSE excluded.due_at END,revision=excluded.revision`,
      params: [chunk, rev, token],
    });
  if (restored) {
    statements.push({
      sql: "DELETE FROM {maintenance} WHERE job LIKE 'holiday:%' AND EXISTS(SELECT 1 FROM {state} WHERE token=?)",
      params: [token],
    });
    statements.push({
      sql: "DELETE FROM {sources} WHERE EXISTS(SELECT 1 FROM {state} WHERE token=?)",
      params: [token],
    });
    for (const chunk of jsonChunks(
      restored.sources.filter(
        (source) => source.year >= year && source.year <= year + 1,
      ),
    ))
      statements.push({
        sql: `${jsonRows} INSERT INTO {sources}(year,hash,data,error,updated_at) SELECT ${["year", "hash", "data", "error", "updated_at"].map(jx).join(",")} FROM idx CROSS JOIN input WHERE EXISTS(SELECT 1 FROM {state} WHERE token=?)`,
        params: [chunk, token],
      });
  }
  if (publishedSource)
    statements.push({
      sql: "INSERT INTO {sources}(year,hash,data,error,updated_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM {state} WHERE token=?) ON CONFLICT(year) DO UPDATE SET hash=excluded.hash,data=excluded.data,error=excluded.error,updated_at=excluded.updated_at",
      params: [
        publishedSource.year,
        publishedSource.hash,
        publishedSource.data,
        publishedSource.error,
        publishedSource.updated_at,
        token,
      ],
    });
  const result = await ctx.db.batch(statements);
  if (!result[0]?.changes)
    throw new Error("配置已变化或存在发送中请求，请刷新后重试");
  return rev;
}
