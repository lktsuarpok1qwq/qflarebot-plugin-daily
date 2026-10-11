import type { DBStatement } from "@qqbot/sdk";
import type { CalendarConfig, Source } from "./types.js";
import type { RestorePart } from "../../shared/types.js";
import { validateCalendar } from "./validation.js";
import { validateYear, refreshEvents } from "./calendar.js";
import { hash } from "./source.js";
import { dateAt } from "../../shared/date.js";
import { fields } from "../../shared/validation.js";
import { jsonChunks, jsonRows, jx } from "../../shared/sql.js";
import { READ_STATEMENTS, decode } from "./repository.js";
type CalendarBackup = { config: CalendarConfig; sources: Source[] };
async function validate(value: unknown) {
    const b = value as CalendarBackup;

    if (!b || typeof b !== "object" || Array.isArray(b) || !Array.isArray(b.sources)) {
        throw new Error("日历备份格式错误");
    }

    fields(b, ["config", "sources"]);
    validateCalendar(b.config);
    const years = new Set<string>();

    for (const s of b.sources) {
        if (
            !s ||
            !Number.isInteger(s.year) ||
            s.year < 2000 ||
            s.year > 2199 ||
            years.has(String(s.year)) ||
            typeof s.data !== "string" ||
            new TextEncoder().encode(s.data).length > 128000 ||
            typeof s.hash !== "string" ||
            (s.data ? !/^[a-f0-9]{64}$/.test(s.hash) : s.hash !== "") ||
            (s.error !== null && typeof s.error !== "string") ||
            !Number.isFinite(s.updated_at) ||
            !Number.isFinite(s.checked_at)
        ) {
            throw new Error("假期源备份非法");
        }

        years.add(String(s.year));

        if (s.data) {
            validateYear(JSON.parse(s.data), s.year);
        }
    }

    for (const source of b.sources) {
        if (source.data && (await hash(source.data)) !== source.hash) {
            throw new Error("备份假期源指纹不匹配");
        }
    }
}
export const backup = {
    read: READ_STATEMENTS,
    decode(rows: { results: unknown[] }[]) {
        const { snapshot, sources } = decode(rows);
        return { revision: snapshot.revision, data: { config: snapshot.config, sources } };
    },
    validate,
    restore(value: unknown, revision: number, now: number): RestorePart {
        const b = structuredClone(value) as CalendarBackup,
            year = +dateAt(now).slice(0, 4);
        refreshEvents(b.config, b.sources, now);
        validateCalendar(b.config);
        return {
            guard: { sql: "EXISTS(SELECT 1 FROM {calendar_state} WHERE id=1 AND revision=?)", params: [revision] },
            statements(gate) {
                const statements: DBStatement[] = [
                    {
                        sql: `UPDATE {calendar_state} SET revision=revision+1,config=?,token=? WHERE id=1 AND (${gate.sql})`,
                        params: [JSON.stringify(b.config), crypto.randomUUID(), ...(gate.params ?? [])],
                    },
                    { sql: `DELETE FROM {calendar_sources} WHERE ${gate.sql}`, params: gate.params },
                    { sql: `DELETE FROM {calendar_jobs} WHERE ${gate.sql}`, params: gate.params },
                ];

                for (const chunk of jsonChunks(b.sources.filter((s) => s.year >= year && s.year <= year + 1))) {
                    statements.push({
                        sql: `${jsonRows} INSERT INTO {calendar_sources}(year,hash,data,error,updated_at,checked_at) SELECT ${["year", "hash", "data", "error", "updated_at", "checked_at"].map(jx).join(",")} FROM idx CROSS JOIN input WHERE ${gate.sql}`,
                        params: [chunk, ...(gate.params ?? [])],
                    });
                }

                return statements;
            },
        };
    },
};
