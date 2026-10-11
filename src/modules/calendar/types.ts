export type CalendarEvent = {
    id: string;
    enabled: boolean;
    name: string;
    start: string;
    end: string;
    kind: "holiday" | "makeup" | "reference" | "event";
    repeat: "once" | "yearly";
    source: "uapi" | "manual";
    /** 条目批次元数据，不参与查询和调度 */
    batchId?: string;
};
export type CalendarCopy = typeof import("./copy.js").CALENDAR_COPY.text;
export type SourceSummary = {
    year: number;
    hash: string;
    has_schedule: number;
    is_complete: number;
    error: string | null;
    updated_at: number;
    checked_at: number;
};

export type CalendarCommand = "假期" | "假期 下个" | "假期 剩余";
export type Source = SourceSummary & { data: string };
export const CALENDAR_VERSION = 5;
export const EVENT_LIMIT = 600;
export type CalendarConfig = {
    schemaVersion: typeof CALENDAR_VERSION;
    events: CalendarEvent[];
    calendarCopy: CalendarCopy;
};
export type CalendarSnapshot = { revision: number; config: CalendarConfig };
