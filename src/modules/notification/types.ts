import { BODY_BYTES } from "../../shared/types.js";
import { SCHEMA_VERSION } from "../../shared/state.js";
export { SCHEMA_VERSION } from "../../shared/state.js";
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
    templateId: string;
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
export type MessageTemplate = { id: string; name: string; body: string };
export type Config = {
    schemaVersion: typeof SCHEMA_VERSION;
    paused: boolean;
    retentionDays: number;
    tasks: Task[];
    templates: MessageTemplate[];
    recipients: Recipient[];
    bindings: Binding[];
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
export const LIMITS = {
    tasks: 20,
    templates: 50,
    recipients: 50,
    bindings: 100,
    bodyBytes: BODY_BYTES,
    reserveMs: 21_000,
    requestBudgetMs: 20_000,
};

export const CONFIG_KEYS = ["schemaVersion", "paused", "retentionDays", "tasks", "templates", "recipients", "bindings"] as const;
