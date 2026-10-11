export type CalendarEvent = {
    id: string;
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
    | "remaining"
    | "today"
    | "makeupToday"
    | "ordinary"
    | "unknown"
    | "none"
    | "ongoing"
    | "stale",
    string
>;
export type Source = {
    year: number;
    hash: string;
    data: string;
    error: string | null;
    updated_at: number;
    checked_at?: number | null;
};
