import type { CalendarConfig, CalendarEvent, Source } from "./types.js";
import { dateAt, DAY, validDate, addDays } from "../../shared/date.js";
import { FESTIVALS, matchesFestival, validateYear } from "./year-data.js";

function automaticEvents(sources: Source[]): CalendarEvent[] {
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

    // 参考日期不参与法定假期条目的分组
    return [...rows, ...references];
}

// 在参考日期替换为正式安排或开始日期修正后匹配同一节日
function sameFestival(a: CalendarEvent, b: CalendarEvent): boolean {
    const identity = (h: CalendarEvent) => {
        const reference = /^uapi-reference-\d{4}-\d{2}-\d{2}-(\d+)$/.exec(h.id);

        return reference
            ? [FESTIVALS[Number(reference[1])]].filter(Boolean)
            : FESTIVALS.filter((f) => matchesFestival(h.name, f));
    };
    const year = (h: CalendarEvent) => /^uapi-(?:holiday|reference)-(\d{4})-/.exec(h.id)?.[1] ?? h.start.slice(0, 4);

    return (
        a.kind !== "makeup" &&
        b.kind !== "makeup" &&
        year(a) === year(b) &&
        (a.name === b.name || identity(a).some((f) => identity(b).includes(f)))
    );
}

/** 仅按查询年份展开每年重复定义，不持久化展开结果 */
export function activeEvents(config: CalendarConfig, year = +dateAt(Date.now()).slice(0, 4)): CalendarEvent[] {
    const events = config.events.flatMap((h) => {
        if (h.repeat !== "yearly") {
            return [h];
        }

        const first = Math.max(year, +h.start.slice(0, 4));
        const occurrences: CalendarEvent[] = [];

        // 两次展开即可覆盖今年和下次事件；闰日事件
        // 跳过无效年份，包括 2100 这样的非闰世纪年
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

    // 人工修改仅覆盖指定日期，不移除同一假期的其他日期
    return events
        .flatMap((h) => {
            if (h.kind === "reference") {
                if (
                    formal.some(
                        (f) =>
                            (f.start <= h.start && f.end >= h.start) ||
                            (f.start.slice(0, 4) === h.start.slice(0, 4) && matchesFestival(f.name, h.name)),
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

    // 移除过期数据源后，保留仍在进行的跨年假期的已知开始日期
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

/** 移除一条人工覆盖，并根据最新接口缓存重建 */
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
            ? defaults.find((h) => h.kind === "holiday" && h.start === lower && matchesFestival(h.name, "元旦"))
            : undefined;

    if (!sources.some((s) => s.year === +year && s.data) && !crossYear) {
        throw new Error("没有可恢复的年度缓存，请先同步数据");
    }

    // 新增标识及正式替换条目已在同步时写入配置
    // 恢复当前标识对应的条目或其跨年剩余部分，保留其他条目
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
