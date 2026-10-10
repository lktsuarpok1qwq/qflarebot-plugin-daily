import { DatabaseSync } from "node:sqlite";
import { createMockContext } from "@qqbot/sdk/testing";
import { scopeSql } from "@qqbot/sdk/sqlScope";
import type { PluginDB, DBStatement } from "@qqbot/sdk";
import { vi, afterEach } from "vitest";
import { install, saveConfig, snapshot } from "../src/data/repository.js";
import { defaults } from "../src/content/templates.js";
const databases = new Set<DatabaseSync>();
afterEach(() => {
  for (const db of databases) db.close();
  databases.clear();
});
export function database() {
  const sqlite = new DatabaseSync(":memory:");
  databases.add(sqlite);
  const metrics = { queries: 0, changes: 0 };
  let failBatch = false;
  const prepare = (sql: string, params: readonly unknown[] = []) => {
    if (new TextEncoder().encode(sql).length > 100_000)
      throw Error("D1 SQL length limit");
    if (params.length > 100) throw Error("D1 parameter count limit");
    if (
      params.some(
        (p) =>
          typeof p === "string" &&
          new TextEncoder().encode(p).length > 2_000_000,
      )
    )
      throw Error("D1 value length limit");
    metrics.queries++;
    return sqlite.prepare(scopeSql(sql, "p_daily_"));
  };
  const db: PluginDB = {
    table: (n) => "p_daily_" + n,
    async exec(sql) {
      sqlite.exec(scopeSql(sql, "p_daily_"));
    },
    async run(sql, ...params) {
      const r = prepare(sql, params).run(...(params as never[]));
      metrics.changes += Number(r.changes);
      return { changes: Number(r.changes) };
    },
    async all<T>(sql: string, ...params: unknown[]) {
      return prepare(sql, params).all(...(params as never[])) as T[];
    },
    async first<T>(sql: string, ...params: unknown[]) {
      return (prepare(sql, params).get(...(params as never[])) ??
        null) as T | null;
    },
    async batch<T>(statements: readonly DBStatement[]) {
      sqlite.exec("BEGIN");
      const before = metrics.changes;
      try {
        const result = [];
        for (const s of statements) {
          const p = prepare(s.sql, s.params);
          if (p.columns().length) {
            result.push({
              changes: 0,
              results: p.all(...((s.params ?? []) as never[])) as T[],
            });
          } else {
            const r = p.run(...((s.params ?? []) as never[]));
            metrics.changes += Number(r.changes);
            result.push({ changes: Number(r.changes), results: [] as T[] });
          }
        }
        if (failBatch) {
          failBatch = false;
          throw Error("simulated transaction failure");
        }
        sqlite.exec("COMMIT");
        return result;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        metrics.changes = before;
        throw e;
      }
    },
  };
  const ctx = createMockContext({ name: "daily" }, { db, botId: "bot" });
  const send = vi.fn(async () => ({
    ok: true,
    status: 200,
    messageId: "message",
    raw: null,
  }));
  ctx.api.sendMessage = send;
  return {
    ctx,
    db,
    sqlite,
    metrics,
    send,
    failNextBatch: () => {
      failBatch = true;
    },
  };
}
export const start = Date.parse("2026-10-10T08:59:00+08:00"),
  dueTime = Date.parse("2026-10-10T09:00:00+08:00");
export async function fixture(count = 1) {
  const env = database();
  await install(env.ctx);
  const c = defaults();
  c.tasks = [
    {
      id: "task",
      name: "每日任务",
      enabled: true,
      origin: "manual",
      schedule: { kind: "daily", time: "09:00" },
      body: "你好 {{日期}}",
    },
  ];
  for (let i = 0; i < count; i++) {
    c.recipients.push({
      id: "r" + i,
      scene: i % 2 ? "c2c" : "group",
      openid: "openid" + i,
      name: "目标" + i,
      enabled: true,
      botId: "bot",
    });
    c.bindings.push({
      taskId: "task",
      recipientId: "r" + i,
      enabled: true,
      overrideText: null,
    });
  }
  await saveConfig(env.ctx, await snapshot(env.db), c, start);
  return { ...env, config: c };
}

export function holidayResponse(year: number) {
  return {
    query: { year: String(year), holiday_type: "legal" },
    holidays: [
      { name: "元旦", date: `${year}-01-01`, type: "legal_rest" },
      { name: "元旦", date: `${year}-01-02`, type: "legal_rest" },
      { name: "元旦", date: `${year}-01-03`, type: "legal_rest" },
      { name: "元旦", date: `${year}-01-04`, type: "legal_workday_adjust" },
    ],
  };
}

export function referenceResponse(year = 2027) {
  return {
    query: { year: String(year), holiday_type: "legal" },
    holidays: [] as { name: string; date: string; type: string }[],
    days: [
      { date: `${year}-01-01`, solar_festival: "元旦" },
      { date: `${year}-02-06`, lunar_festival: "春节" },
      { date: `${year}-04-05`, lunar_festival: "清明节", solar_term: "清明" },
      { date: `${year}-05-01`, solar_festival: "五一劳动节" },
      { date: `${year}-06-09`, lunar_festival: "端午节" },
      { date: `${year}-09-15`, lunar_festival: "中秋节" },
      { date: `${year}-10-01`, solar_festival: "国庆节" },
      { date: `${year}-02-14`, solar_festival: "情人节" },
      { date: `${year}-06-21`, solar_term: "夏至" },
      { date: `${year}-09-10`, solar_festival: "教师节" },
    ],
  };
}
