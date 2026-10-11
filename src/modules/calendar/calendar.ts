import type { CalendarConfig, CalendarEvent, Source, SourceSummary } from "./types.js";
import { dateAt, DAY, validDate, addDays } from "../../shared/date.js";
export const FESTIVALS = ["元旦", "春节", "清明节", "劳动节", "端午节", "中秋节", "国庆节"] as const;
const aliases: Record<string, string> = {
    清明: "清明节",
    五一劳动节: "劳动节",
    国际劳动节: "劳动节",
};
type FestivalDate = { name: string; date: string };
const matches = (name: string, festival: string) => name.includes(festival.replace(/节$/, ""));
export type CalendarYear = {
    year: number;
    dates?: FestivalDate[];
    holidays: {
        name: string;
        date: string;
        type: "legal_rest" | "legal_workday_adjust";
    }[];
};
export function validateYear(value: unknown, year: number): CalendarYear {
    const x = value as CalendarYear;

    if (!x || x.year !== year || !Array.isArray(x.holidays) || x.holidays.length > 400) {
        throw new Error("UAPI 年度数据格式错误");
    }

    const days = new Set<string>();
    const holidays = x.holidays
        .map((h) => {
            if (
                !h ||
                typeof h.name !== "string" ||
                !h.name.trim() ||
                h.name.length > 80 ||
                /[\u0000-\u001f]/.test(h.name) ||
                !validDate(h.date) ||
                +h.date.slice(0, 4) !== year ||
                !["legal_rest", "legal_workday_adjust"].includes(h.type) ||
                days.has(h.date)
            ) {
                throw new Error("UAPI 放假或调休记录非法");
            }

            days.add(h.date);
            return { name: h.name, date: h.date, type: h.type };
        })
        .sort((a, b) => a.date.localeCompare(b.date));
    const dates = x.dates ?? [];

    if (!Array.isArray(dates) || dates.length > FESTIVALS.length) {
        throw new Error("UAPI 节日日期格式错误");
    }

    const names = new Set<string>();

    for (const d of dates) {
        if (
            !d ||
            !FESTIVALS.some((name) => name === d.name) ||
            names.has(d.name) ||
            !validDate(d.date) ||
            +d.date.slice(0, 4) !== year
        ) {
            throw new Error("UAPI 节日日期非法");
        }

        names.add(d.name);
    }

    const pending = dates
        .filter((d) => !holidays.some((h) => h.type === "legal_rest" && (matches(h.name, d.name) || h.date === d.date)))
        .map(({ name, date }) => ({ name, date }))
        .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
    return { year, holidays, ...(pending.length ? { dates: pending } : {}) };
}
export function parseResponse(value: unknown, year: number): CalendarYear {
    const x = value as {
        query?: { year?: string; holiday_type?: string };
        holidays?: unknown;
        days?: {
            date: string;
            solar_festival?: string;
            lunar_festival?: string;
            solar_term?: string;
        }[];
    };

    if (x?.query?.year !== String(year) || x.query.holiday_type !== "legal") {
        throw new Error("UAPI 返回的年度或类别不匹配");
    }

    if (x.days !== undefined && (!Array.isArray(x.days) || x.days.length > 366)) {
        throw new Error("UAPI 日历格式错误");
    }

    const dates = new Map<string, FestivalDate>();

    for (const day of x.days ?? []) {
        if (!day || !validDate(day.date) || +day.date.slice(0, 4) !== year) {
            throw new Error("UAPI 日历日期非法");
        }

        for (const raw of [day.solar_festival, day.lunar_festival, day.solar_term]) {
            const name = typeof raw === "string" ? (aliases[raw] ?? raw) : "";

            if (!FESTIVALS.some((festival) => festival === name)) {
                continue;
            }

            if (dates.has(name) && dates.get(name)!.date !== day.date) {
                throw new Error("UAPI 节日日期冲突");
            }

            dates.set(name, { name, date: day.date });
        }
    }

    return validateYear({ year, holidays: x.holidays, dates: [...dates.values()] }, year);
}
export function summarizeYear(value: CalendarYear) {
    const rows = value.holidays.filter((h) => h.type === "legal_rest");
    return {
        has_schedule: rows.length ? 1 : 0,
        is_complete: FESTIVALS.every((name) => rows.some((h) => matches(h.name, name))) ? 1 : 0,
    };
}
/** Only a complete next year can reduce its refresh frequency. */
export function refreshDays(source: Pick<SourceSummary, "has_schedule" | "is_complete"> | undefined, nextYear: boolean): number {
    return (nextYear ? source?.is_complete : source?.has_schedule) === 1 ? 7 : 1;
}
/** Replace returned festivals as a unit; absent festivals retain known data. */
export function mergeYear(incoming: CalendarYear, previous: CalendarYear | undefined) {
    const identities = (name: string): string[] => {
        const festivals = FESTIVALS.filter((f) => matches(name, f));
        return festivals.length ? festivals : [name];
    };
    const returned = new Set(
        incoming.holidays.filter((h) => h.type === "legal_rest").flatMap((h) => identities(h.name)),
    );
    const dates = new Set(incoming.holidays.map((h) => h.date));
    const retained = (previous?.holidays ?? []).filter(
        (h) => !identities(h.name).every((name) => returned.has(name)) && !dates.has(h.date),
    );
    const references = new Map((previous?.dates ?? []).map((d) => [d.name, d]));

    for (const d of incoming.dates ?? []) {
        references.set(d.name, d);
    }

    return {
        value: validateYear(
            {
                ...incoming,
                holidays: [...incoming.holidays, ...retained],
                dates: [...references.values()],
            },
            incoming.year,
        ),
        incomplete: retained.length > 0,
    };
}
export function automaticEvents(sources: Source[]): CalendarEvent[] {
    const rows: CalendarEvent[] = [],
        references: CalendarEvent[] = [];

    for (const source of [...sources].sort((a, b) => a.year - b.year)) {
        if (!source.data) {
            continue;
        }

        const calendar = validateYear(JSON.parse(source.data), source.year);

        for (const d of calendar.holidays) {
            const kind = d.type === "legal_rest" ? "holiday" : "makeup";
            const previous = rows.at(-1);

            if (
                kind === "holiday" &&
                previous?.kind === kind &&
                previous.name === d.name &&
                Date.parse(d.date) - Date.parse(previous.end) === DAY
            ) {
                previous.end = d.date;
            } else {
                rows.push({
                    enabled: true,
                    id: `uapi-${kind}-${d.date}`,
                    name: d.name,
                    start: d.date,
                    end: d.date,
                    kind,
                    source: "uapi",
                    repeat: "once",
                });
            }
        }

        for (const d of calendar.dates ?? []) {
            references.push({
                enabled: true,
                id: `uapi-reference-${d.date}-${FESTIVALS.indexOf(d.name as (typeof FESTIVALS)[number])}`,
                name: d.name,
                start: d.date,
                end: d.date,
                kind: "reference",
                source: "uapi",
                repeat: "once",
            });
        }
    }

    // References never participate in grouping legal rows.
    return [...rows, ...references];
}
// Match a festival across reference/formal replacement and corrected start dates.
function sameFestival(a: CalendarEvent, b: CalendarEvent): boolean {
    const identity = (h: CalendarEvent) => {
        const reference = /^uapi-reference-\d{4}-\d{2}-\d{2}-(\d+)$/.exec(h.id);
        return reference
            ? [FESTIVALS[Number(reference[1])]].filter(Boolean)
            : FESTIVALS.filter((f) => matches(h.name, f));
    };
    const year = (h: CalendarEvent) => /^uapi-(?:holiday|reference)-(\d{4})-/.exec(h.id)?.[1] ?? h.start.slice(0, 4);
    return (
        a.kind !== "makeup" &&
        b.kind !== "makeup" &&
        year(a) === year(b) &&
        (a.name === b.name || identity(a).some((f) => identity(b).includes(f)))
    );
}
/** Expand yearly definitions only for the queried years; never persist occurrences. */
export function activeEvents(config: CalendarConfig, year = +dateAt(Date.now()).slice(0, 4)): CalendarEvent[] {
    const events = config.events.flatMap((h) => {
        if (h.repeat !== "yearly") {
            return [h];
        }

        const first = Math.max(year, +h.start.slice(0, 4));
        const occurrences: CalendarEvent[] = [];

        // Two occurrences suffice for this year and the next event. Leap-day events
        // skip invalid years (including century years such as 2100).
        for (let y = first; y <= Math.min(2199, first + 8) && occurrences.length < 2; y++) {
            const date = `${y}-${h.start.slice(5)}`;

            if (validDate(date)) {
                occurrences.push({ ...h, start: date, end: date });
            }
        }

        return occurrences;
    });
    const manual = events.filter((h) => h.source === "manual");
    const formal = events.filter((h) => h.kind === "holiday");
    // A manual date overrides that date, without removing the rest of a holiday.
    return events
        .flatMap((h) => {
            if (h.kind === "reference") {
                if (
                    formal.some(
                        (f) =>
                            (f.start <= h.start && f.end >= h.start) ||
                            (f.start.slice(0, 4) === h.start.slice(0, 4) && matches(f.name, h.name)),
                    )
                ) {
                    return [];
                }

                if (
                    !manual.includes(h) &&
                    manual.some(
                        (m) =>
                            m.kind === "reference" && m.start.slice(0, 4) === h.start.slice(0, 4) && m.name === h.name,
                    )
                ) {
                    return [];
                }

                return [h];
            }

            if (h.kind === "event" || manual.includes(h)) {
                return [h];
            }

            if (manual.some((m) => m.id === h.id)) {
                return [];
            }

            let parts = [h];

            for (const m of manual.filter((m) => m.kind === "holiday" || m.kind === "makeup")) {
                parts = parts.flatMap((part) => {
                    if (m.start > part.end || m.end < part.start) {
                        return [part];
                    }

                    return [
                        ...(part.start < m.start ? [{ ...part, end: addDays(m.start, -1) }] : []),
                        ...(part.end > m.end ? [{ ...part, start: addDays(m.end, 1) }] : []),
                    ];
                });
            }

            return parts;
        })
        .filter((h) => h.enabled);
}
export function refreshEvents(config: CalendarConfig, sources: Source[], now: number) {
    const year = +dateAt(now).slice(0, 4);
    const manual = config.events.filter((h) => h.source === "manual");
    const ids = new Set(manual.map((h) => h.id));
    const lower = `${year}-01-01`;
    const automatic = automaticEvents(sources.filter((s) => s.year <= year + 1));

    // Retain the known start of a still-active cross-year break after its old source is removed.
    for (const old of config.events.filter((h) => h.source === "uapi" && h.start < lower && h.end >= lower)) {
        const current = automatic.find(
            (h) => h.kind === old.kind && h.name === old.name && h.start <= old.end && h.end >= lower,
        );

        if (current && !sources.some((s) => s.year === +old.start.slice(0, 4))) {
            current.start = old.start;
            current.id = old.id;
        } else if (!current && !sources.some((s) => s.year === year && s.has_schedule === 1)) {
            automatic.push(old);
        }
    }

    for (const h of automatic) {
        const prior = config.events.find((old) => old.id === h.id);
        const related = config.events.filter((old) => old.source === "uapi" && sameFestival(old, h));
        h.enabled = prior ? prior.enabled : related.every((old) => old.enabled);
    }

    config.events = [...manual, ...automatic.filter((h) => !ids.has(h.id))]
        .filter((h) => h.repeat === "yearly" || h.end >= lower)
        .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}

/** Drop one manual override and rebuild from the latest cached interface data. */
export function restoreEvent(config: CalendarConfig, sources: Source[], id: string, now: number) {
    const holiday = config.events.find((h) => h.id === id);
    const year = /^uapi-(?:holiday|makeup|reference)-(\d{4})-/.exec(id)?.[1];

    if (!holiday || holiday.source !== "manual" || !year) {
        throw new Error("这条记录没有可恢复的默认数据");
    }

    const defaults = automaticEvents(sources);
    const lower = `${dateAt(now).slice(0, 4)}-01-01`;
    const crossYear =
        +year + 1 === +lower.slice(0, 4) && id.startsWith(`uapi-holiday-${year}-12-`)
            ? defaults.find((h) => h.kind === "holiday" && h.start === lower && matches(h.name, "元旦"))
            : undefined;

    if (!sources.some((s) => s.year === +year && s.data) && !crossYear) {
        throw new Error("没有可恢复的年度缓存，请先同步数据");
    }

    // New IDs/formal replacements already entered config during synchronization.
    // Restore this ID (or its surviving cross-year part), leaving other rows alone.
    const originals = defaults.filter((h) => h.id === id || sameFestival(h, holiday));

    if (!originals.length && crossYear) {
        originals.push(crossYear);
    }

    config.events = config.events.filter((h) => h.id !== id);

    for (const original of originals) {
        const restored = config.events.find((h) => h.id === original.id);

        if (restored) {
            restored.enabled = holiday.enabled;
        } else {
            config.events.push({ ...original, enabled: holiday.enabled });
        }
    }

    config.events.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}
