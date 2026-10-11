import type { PluginDB, DBStatement } from "@qqbot/sdk";
import type { Ctx } from "../../shared/types.js";
import type { CalendarConfig, CalendarSnapshot, Source } from "./types.js";
import { CALENDAR_VERSION } from "./types.js";
import { CALENDAR_COPY } from "./copy.js";
import { dateAt } from "../../shared/date.js";
import { refreshEvents } from "./calendar.js";
import { validateCalendar } from "./validation.js";
export const SOURCE_QUERY = "SELECT * FROM {calendar_sources}";
export function defaults(): CalendarConfig {
    return {
        schemaVersion: CALENDAR_VERSION,
        events: [],
        calendarCopy: structuredClone(CALENDAR_COPY.text),
    };
}
export async function install(ctx: Ctx) {
    await ctx.db.exec(`
        CREATE TABLE IF NOT EXISTS {calendar_state}(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, config TEXT NOT NULL, token TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS {calendar_sources}(year INTEGER PRIMARY KEY, hash TEXT NOT NULL, data TEXT NOT NULL, error TEXT, updated_at INTEGER NOT NULL, checked_at INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS {calendar_jobs}(job TEXT PRIMARY KEY, day TEXT NOT NULL, error TEXT);
    `);
    await ctx.db.run(
        "INSERT OR IGNORE INTO {calendar_state}(id,revision,config,token) VALUES (1,1,?,'initial')",
        JSON.stringify(defaults()),
    );
}
function parseState(state: { revision: number; config: string } | null | undefined): CalendarSnapshot {
    if (!state) {
        throw new Error("日历尚未初始化");
    }

    const config = JSON.parse(state.config) as CalendarConfig;

    if (config.schemaVersion !== CALENDAR_VERSION) {
        throw new Error("日历配置格式不受支持");
    }

    return { revision: state.revision, config };
}
export async function snapshot(db: PluginDB): Promise<CalendarSnapshot> {
    return parseState(
        await db.first<{ revision: number; config: string }>("SELECT revision,config FROM {calendar_state} WHERE id=1"),
    );
}
export const READ_STATEMENTS = [
    { sql: "SELECT revision,config FROM {calendar_state} WHERE id=1" },
    { sql: SOURCE_QUERY },
];
export function decode(rows: { results: unknown[] }[]): { snapshot: CalendarSnapshot; sources: Source[] } {
    return {
        snapshot: parseState(rows[0]?.results[0] as { revision: number; config: string } | undefined),
        sources: rows[1]!.results as Source[],
    };
}
export async function readData(db: PluginDB) {
    return decode(await db.batch(READ_STATEMENTS));
}
export async function saveConfig(
    ctx: Ctx,
    old: CalendarSnapshot,
    config: CalendarConfig,
    now: number,
    published?: Source,
    prune = false,
) {
    const year = +dateAt(now).slice(0, 4);
    config.events = config.events.filter((h) => h.repeat === "yearly" || h.end >= `${year}-01-01`);
    validateCalendar(config);
    const token = crypto.randomUUID();
    const statements: DBStatement[] = [
        {
            sql: "UPDATE {calendar_state} SET revision=revision+1,config=?,token=? WHERE id=1 AND revision=?",
            params: [JSON.stringify(config), token, old.revision],
        },
    ];

    if (published) {
        statements.push({
            sql: "INSERT INTO {calendar_sources}(year,hash,data,error,updated_at,checked_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM {calendar_state} WHERE token=?) ON CONFLICT(year) DO UPDATE SET hash=excluded.hash,data=excluded.data,error=excluded.error,updated_at=excluded.updated_at,checked_at=excluded.checked_at",
            params: [
                published.year,
                published.hash,
                published.data,
                published.error,
                published.updated_at,
                published.checked_at,
                token,
            ],
        });
    }

    if (prune) {
        statements.push({
            sql: "DELETE FROM {calendar_sources} WHERE (year<? OR year>?) AND EXISTS(SELECT 1 FROM {calendar_state} WHERE token=?)",
            params: [year, year + 1, token],
        });
    }

    const result = await ctx.db.batch(statements);

    if (!result[0]?.changes) {
        throw new Error("日历配置已变化，请刷新后重试");
    }

    return old.revision + 1;
}
export async function refreshCalendar(ctx: Ctx, now = Date.now()) {
    const { snapshot: old, sources } = await readData(ctx.db);
    const config = structuredClone(old.config);
    refreshEvents(config, sources, now);
    const year = +dateAt(now).slice(0, 4),
        prune = sources.some((source) => source.year < year || source.year > year + 1);

    if (prune || JSON.stringify(config) !== JSON.stringify(old.config)) {
        await saveConfig(ctx, old, config, now, undefined, prune);
    }

    return config;
}
