import type { Config, Ctx, Source } from "../types.js";
import { LIMITS } from "../types.js";
import { defaults } from "../content/templates.js";
import { COMMAND_NAMES } from "../content/command-templates.js";
import { FIELDS, validateConfig } from "./validation.js";
import { parseBackup, verifyBackup } from "./backup.js";
import { readData, saveConfig } from "./repository.js";
import { refreshHolidays } from "./calendar.js";
import { dateAt } from "../scheduler/planner.js";

const JOB = "upgrade:1.5.1";
const collections = [
  "contents",
  "recipients",
  "holidays",
  "festivals",
  "tasks",
  "bindings",
] as const;
type Collection = (typeof collections)[number];
function pick(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => keys.includes(key)),
  );
}
/** One-time removal of unsupported records, without converting old formats. */
function currentConfig(value: Config): Config {
  const c = defaults();
  c.paused = typeof value.paused === "boolean" ? value.paused : true;
  c.retentionDays = [7, 30, 90].includes(value.retentionDays)
    ? value.retentionDays
    : c.retentionDays;
  for (const name of COMMAND_NAMES) {
    const reply = pick(value.replies?.[name], FIELDS.replies);
    try {
      validateConfig({ ...c, replies: { ...c.replies, [name]: reply } });
      c.replies[name] = reply as Config["replies"][typeof name];
    } catch {
      /* An incompatible command template is reset to its current default. */
    }
  }
  const projected = Object.fromEntries(
    collections.map((key) => [
      key,
      (Array.isArray(value[key]) ? value[key] : []).map((item) => {
        const row = pick(item, FIELDS[key]);
        if (key === "tasks") row.schedule = pick(row.schedule, FIELDS.schedule);
        return row;
      }),
    ]),
  ) as Record<Collection, Record<string, unknown>[]>;
  // The normal deployed configuration needs only one full validation pass.
  try {
    return validateConfig({ ...c, ...projected });
  } catch {
    /* Filter broken rows below. */
  }
  for (const key of collections) {
    const identities = new Set<string>(),
      targets = new Set<string>();
    const maximum = key === "festivals" ? 100 : LIMITS[key];
    for (const row of projected[key]) {
      if (c[key].length >= maximum) break;
      const identity =
        key === "bindings"
          ? `${row.taskId}:${row.recipientId}`
          : String(row.id);
      const target = `${row.scene}:${row.openid}`;
      if (
        identities.has(identity) ||
        (key === "recipients" && targets.has(target))
      )
        continue;
      const probe = { ...defaults(), [key]: [row] };
      if (key === "tasks") probe.contents = c.contents;
      if (key === "bindings") {
        probe.tasks = c.tasks.filter((t) => t.id === row.taskId);
        probe.recipients = c.recipients.filter((r) => r.id === row.recipientId);
        probe.contents = c.contents.filter((content) =>
          probe.tasks.some((t) => t.contentIds.includes(content.id)),
        );
      }
      try {
        validateConfig(probe);
        (c[key] as unknown[]).push(row);
        identities.add(identity);
        targets.add(target);
      } catch {
        /* Dependent tasks and bindings are removed by the same validation. */
      }
    }
  }
  return validateConfig(c);
}

export async function boot(ctx: Ctx, now = Date.now()) {
  const done = await ctx.db.first(
    "SELECT 1 FROM {maintenance} WHERE job=?",
    JOB,
  );
  // Normal calendar upkeep belongs to the daily maintenance job. A cold
  // isolate only needs to check whether the one-time upgrade has finished.
  if (done) return;
  const { snapshot: s, sources } = await readData(ctx.db);
  const config = currentConfig(s.config),
    valid: Source[] = [];
  const year = +dateAt(now).slice(0, 4);
  for (const source of sources) {
    if (source.year < year || source.year > year + 1) continue;
    try {
      await verifyBackup(
        parseBackup(
          {
            schemaVersion: 1,
            botId: ctx.botId,
            exportedAt: new Date(now).toISOString(),
            config: defaults(),
            sources: [source],
            progress: [],
          },
          ctx.botId,
        ),
      );
      valid.push(source);
    } catch {
      /* A corrupt cache is discarded and can be fetched again. */
    }
  }
  refreshHolidays(config, valid, now);
  validateConfig(config);
  // Configuration, cached sources and future cursors publish atomically. The
  // delivery history and durable event progress are deliberately retained.
  const revision = await saveConfig(
    ctx,
    { ...s, config },
    config,
    now,
    false,
    { sources: valid, progress: [] },
    undefined,
    true,
  );
  // Idempotent finalization: if interrupted, a later boot safely repeats it.
  await ctx.db.batch([
    { sql: "DROP TABLE IF EXISTS {recipient_state}" },
    { sql: "DROP TABLE IF EXISTS {discovered}" },
    {
      sql: "DELETE FROM {maintenance} WHERE job NOT IN ('sync','cleanup','sync:official:0','sync:official:1','sync:festival:0','sync:festival:1',?)",
      params: [JOB],
    },
    {
      sql: "INSERT OR IGNORE INTO {maintenance}(job,day,error) SELECT ?,?,NULL WHERE EXISTS(SELECT 1 FROM {state} WHERE revision=?)",
      params: [JOB, dateAt(now), revision],
    },
  ]);
}
