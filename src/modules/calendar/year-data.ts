import type { SourceSummary } from "./types.js";
import { validDate } from "../../shared/date.js";

export const FESTIVALS = ["元旦", "春节", "清明节", "劳动节", "端午节", "中秋节", "国庆节"] as const;
const aliases: Record<string, string> = {
    清明: "清明节",
    五一劳动节: "劳动节",
    国际劳动节: "劳动节",
};
type FestivalDate = { name: string; date: string };
export const matchesFestival = (name: string, festival: string) => name.includes(festival.replace(/节$/, ""));
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
        .filter((d) => !holidays.some((h) => h.type === "legal_rest" && (matchesFestival(h.name, d.name) || h.date === d.date)))
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
        is_complete: FESTIVALS.every((name) => rows.some((h) => matchesFestival(h.name, name))) ? 1 : 0,
    };
}

/** 下一年数据完整时才可降低刷新频率 */
export function refreshDays(source: Pick<SourceSummary, "has_schedule" | "is_complete"> | undefined, nextYear: boolean): number {
    return (nextYear ? source?.is_complete : source?.has_schedule) === 1 ? 7 : 1;
}

/** 接口返回的节日整体替换，未返回的节日保留已知数据 */
export function mergeYear(incoming: CalendarYear, previous: CalendarYear | undefined) {
    const identities = (name: string): string[] => {
        const festivals = FESTIVALS.filter((f) => matchesFestival(name, f));

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
