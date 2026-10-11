import type { CalendarEvent, CalendarCopy } from "./modules/calendar/types.js";
export type { CalendarEvent, CalendarCopy, Source } from "./modules/calendar/types.js";
import type { PluginContext } from "@qqbot/sdk";
export type CommandName = "每日" | "每日 帮助" | "假期" | "假期 帮助" | "假期 下一个" | "假期 剩余";
export type CommandReply = {
    body: string;
    item: string;
    reference: string;
    event: string;
    empty: string;
    unknown: string;
    stale: string;
    ongoing: string;
    makeupEmpty: string;
    error: string;
    tooLong: string;
};
export type Ctx = PluginContext;
export type Scene = "group" | "c2c";
export type Schedule =
    | { kind: "daily"; time: string }
    | { kind: "weekly"; time: string; weekdays: number[] }
    | { kind: "once"; time: string; date: string };
export type Task = {
    id: string;
    name: string;
    enabled: boolean;
    origin: "system" | "manual";
    schedule: Schedule;
    body: string;
};
export type Recipient = {
    id: string;
    scene: Scene;
    openid: string;
    name: string;
    enabled: boolean;
    botId: string;
};
export type Binding = {
    taskId: string;
    recipientId: string;
};
export const SCHEMA_VERSION = 4;
export type Config = {
    schemaVersion: typeof SCHEMA_VERSION;
    paused: boolean;
    retentionDays: number;
    tasks: Task[];
    recipients: Recipient[];
    bindings: Binding[];
    events: CalendarEvent[];
    calendarCopy: CalendarCopy;
    replies: Record<CommandName, CommandReply>;
};
export type Snapshot = { revision: number; botId: string; config: Config };
export type Plan = { due: number };
export type Due = {
    key?: string | null;
    id: string;
    task_id: string;
    recipient_id: string;
    due_at: number;
    revision: number;
    status: string | null;
    claimed_at: number | null;
};
export type DeliveryStatus =
    | "sending"
    | "success"
    | "failed_api"
    | "failed_validation"
    | "uncertain"
    | "skipped_empty"
    | "skipped_expired"
    | "skipped_disabled"
    | "skipped_budget";
export type Rendered = {
    text: string;
};
export const LIMITS = {
    tasks: 20,
    recipients: 50,
    bindings: 100,
    events: 600,
    bodyBytes: 256_000,
    backupBytes: 8_000_000,
    batch: 5,
    concurrency: 2,
    reserveMs: 21_000,
    requestBudgetMs: 20_000,
};
