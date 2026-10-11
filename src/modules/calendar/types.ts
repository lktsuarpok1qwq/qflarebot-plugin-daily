export type CalendarEvent = {
    id: string;
    enabled: boolean;
    name: string;
    start: string;
    end: string;
    kind: "holiday" | "makeup" | "reference" | "event";
    repeat: "once" | "yearly";
    source: "uapi" | "manual";
    batchId?: string;
};
export type CalendarCopy = Record<
    | "summary"
    | "reference"
    | "event"
    | "eventToday"
    | "today"
    | "makeupToday"
    | "ordinary"
    | "unknown"
    | "none"
    | "ongoing"
    | "stale"
    | "makeupEmpty"
    | "noneRemaining"
    | "help",
    string
>;
export type Source = {
    year: number;
    hash: string;
    data: string;
    error: string | null;
    updated_at: number;
    checked_at: number;
};

export type CalendarCommand = "假期" | "假期 下个" | "假期 剩余";
export const CALENDAR_VERSION = 3;
export const EVENT_LIMIT = 600;
export type CalendarConfig = {
    schemaVersion: typeof CALENDAR_VERSION;
    events: CalendarEvent[];
    calendarCopy: CalendarCopy;
};
export type CalendarSnapshot = { revision: number; config: CalendarConfig };
