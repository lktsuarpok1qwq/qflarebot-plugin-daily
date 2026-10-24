import type { PluginDB } from "@qqbot/sdk";
import { AdminError } from "../../shared/admin-errors.js";
import { createConfigStore } from "../../shared/config-store.js";
import type { Ctx } from "../../shared/types.js";
import { dateAt } from "../../shared/date.js";
import { defaults, parseConfig, validate } from "./config.js";

const store = createConfigStore({ table: "murmur_state", label: "絮语", defaults, parse: parseConfig, validate });
export const save = store.save;
export type Entry = { id: number; revision: number; text: string; position: number; usedDay: string | null };
type Current = { revision: number; template: string; text: string | null };

export async function install(ctx: Pick<Ctx, "db">) {
    await ctx.db.batch([
        { sql: "CREATE TABLE IF NOT EXISTS {murmur_state}(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,config TEXT NOT NULL)" },
        { sql: "INSERT OR IGNORE INTO {murmur_state}(id,revision,config) VALUES(1,1,?)", params: [JSON.stringify(defaults())] },
        { sql: "CREATE TABLE IF NOT EXISTS {murmur_entries}(id INTEGER PRIMARY KEY AUTOINCREMENT,revision INTEGER NOT NULL DEFAULT 1,body TEXT NOT NULL,position INTEGER NOT NULL CHECK(position>0),used_day TEXT UNIQUE)" },
        { sql: "CREATE INDEX IF NOT EXISTS {murmur_order} ON {murmur_entries}(position,id)" },
        { sql: "CREATE INDEX IF NOT EXISTS {murmur_queue} ON {murmur_entries}(position,id) WHERE used_day IS NULL" },
    ]);
}

export function snapshot(db: PluginDB) {
    return store.snapshot(db);
}

export async function current(db: PluginDB, day: string): Promise<Current> {
    const row = await db.first<{ revision: number; schema_version: number; template: string; body: string | null }>(`SELECT s.revision,
        json_extract(s.config,'$.schemaVersion') AS schema_version,
        json_extract(s.config,'$.copy.today') AS template,e.body FROM {murmur_state} s
        LEFT JOIN {murmur_entries} e ON e.used_day=? WHERE s.id=1`, day);

    if (!row || row.schema_version !== 1 || typeof row.template !== "string") {
        throw new Error("絮语配置格式错误");
    }

    return { revision: row.revision, template: row.template, text: row.body };
}

export async function selectDay(db: PluginDB, day: string, revision: number) {
    // 优先选用新文案；用完后轮换排在最前的文案，选中后移到队尾，同日并发只会选中一篇
    return db.first<{ text: string }>(`UPDATE {murmur_entries} SET used_day=?,position=(SELECT COALESCE(MAX(position),0)+1 FROM {murmur_entries}) WHERE id=COALESCE(
        (SELECT id FROM {murmur_entries} WHERE used_day IS NULL ORDER BY position,id LIMIT 1),
        (SELECT id FROM {murmur_entries} INDEXED BY {murmur_order} WHERE used_day<? ORDER BY position,id LIMIT 1))
        AND NOT EXISTS(SELECT 1 FROM {murmur_entries} WHERE used_day=?)
        AND EXISTS(SELECT 1 FROM {murmur_state} WHERE id=1 AND revision=?)
        RETURNING body AS text`, day, day, day, revision);
}

export async function entries(db: PluginDB, used: boolean, cursor: number) {
    const rows = await db.all<{ id: number; revision: number; usedDay: string | null; position: number; excerpt: string }>(`SELECT id,revision,position,used_day AS usedDay,substr(body,1,40) AS excerpt FROM {murmur_entries}
        WHERE used_day IS ${used ? "NOT " : ""}NULL ${cursor ? "AND position>?" : ""}
        ORDER BY position,id LIMIT 21`, ...cursor ? [cursor] : []);

    return { items: rows.slice(0, 20), next: rows.length > 20 ? rows[19]!.position : null };
}

export async function entry(db: PluginDB, id: number) {
    const row = await db.first<Entry>("SELECT id,revision,position,body AS text,used_day AS usedDay FROM {murmur_entries} WHERE id=?", id);

    if (!row) { throw new AdminError("conflict", "文案已删除，请重新加载"); }

    return row;
}

export async function saveEntry(db: PluginDB, id: number | null, revision: number, text: string) {
    const result = id === null
        ? await db.first<Entry>("INSERT INTO {murmur_entries}(body,position) SELECT ?,COALESCE(MAX(position),0)+1 FROM {murmur_entries} RETURNING id,revision,position,body AS text,used_day AS usedDay", text)
        : await db.first<Entry>("UPDATE {murmur_entries} SET body=?,revision=revision+1 WHERE id=? AND revision=? AND used_day IS NOT ? RETURNING id,revision,position,body AS text,used_day AS usedDay", text, id, revision, dateAt(Date.now()));

    if (!result) { throw new AdminError("conflict", "文案已变化或已在今天选用，请重新加载"); }

    return result;
}

export async function deleteEntry(db: PluginDB, id: number, revision: number) {
    const result = await db.run("DELETE FROM {murmur_entries} WHERE id=? AND revision=? AND used_day IS NOT ?", id, revision, dateAt(Date.now()));

    if (!result.changes) { throw new AdminError("conflict", "文案已变化或已在今天选用，请重新加载"); }
}

export function addEntries(db: PluginDB, texts: string[]) {
    const values = texts.map((_, index) => `(${index},?)`).join(",");

    return db.all<Entry>(`WITH incoming(offset,body) AS (VALUES ${values})
        INSERT INTO {murmur_entries}(body,position)
        SELECT incoming.body,base.position+incoming.offset+1 FROM incoming
        CROSS JOIN (SELECT COALESCE(MAX(position),0) AS position FROM {murmur_entries}) base
        RETURNING id,revision,position,body AS text,used_day AS usedDay`, ...texts);
}

export async function moveEntry(db: PluginDB, id: number, revision: number, direction: "up" | "down") {
    const day = dateAt(Date.now()), operator = direction === "up" ? "<" : ">", order = direction === "up" ? "DESC" : "ASC";
    // 单条语句交换相邻位置，锁住当前日期并同时核对发起条目的版本
    const rows = await db.all<{ id: number; revision: number; position: number }>(`WITH target AS MATERIALIZED (
        SELECT id,position FROM {murmur_entries} WHERE id=? AND revision=? AND used_day IS NOT ?),
        neighbor AS MATERIALIZED (SELECT id,position FROM {murmur_entries}
        WHERE position ${operator} (SELECT position FROM target) AND used_day IS NOT ?
        AND (used_day IS NULL)=(SELECT used_day IS NULL FROM {murmur_entries} WHERE id=?)
        ORDER BY position ${order} LIMIT 1), pair AS MATERIALIZED (
        SELECT t.id,n.position FROM target t CROSS JOIN neighbor n UNION ALL SELECT n.id,t.position FROM neighbor n CROSS JOIN target t)
        UPDATE {murmur_entries} SET position=(SELECT position FROM pair WHERE pair.id={murmur_entries}.id),revision=revision+1
        WHERE id IN (SELECT id FROM pair) RETURNING id,revision,position`, id, revision, day, day, id);

    if (rows.length !== 2) { throw new AdminError("conflict", "顺序已变化、到达边界或今天已选用，请重新查询"); }

    return rows;
}
