import type { PluginContext } from "@qqbot/sdk";
export type MessageFormat = "plain" | "markdown";
export type CommandName =
  "每日" | "每日 帮助" | "假期" | "假期 帮助" | "假期 下一个" | "假期 剩余";
export type CommandReply = {
  format: MessageFormat;
  body: string;
  official: string;
  provisional: string;
  separator: string;
  empty: string;
  unknown: string;
  stale: string;
  ongoing: string;
  makeupEmpty: string;
  error: string;
  tooLong: string;
};
export type Festival = {
  id: string;
  key: string;
  name: string;
  date: string;
  source: string;
  manual?: boolean;
};
export type Ctx = PluginContext;
export type Scene = "group" | "c2c";
export type Schedule = {
  kind: "daily" | "weekly" | "once" | "yearly" | "holiday_event";
  time: string;
  weekdays?: number[];
  date?: string;
  monthDay?: string;
  eventKind?: "holiday" | "makeup" | "festival";
  offset?: number;
};
export type Content = {
  id: string;
  name: string;
  enabled: boolean;
  kind: "text" | "date" | "holiday";
  body: string;
  referenceBody?: string;
  only?: "always" | "holiday" | "makeup";
};
export type Task = {
  id: string;
  name: string;
  enabled: boolean;
  mode: "standalone" | "digest";
  format: MessageFormat;
  schedule: Schedule;
  contentIds: string[];
  title: string;
  separator: string;
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
  enabled: boolean;
  overrideText: string | null;
  overrideFormat: MessageFormat;
};
export type Holiday = {
  id: string;
  name: string;
  start: string;
  end: string;
  kind: "holiday" | "makeup";
  source: string;
  manual?: boolean;
  sourceHash?: string;
  batchId?: string;
  festivalIds?: string[];
};
export type Config = {
  schemaVersion: 1;
  paused: boolean;
  retentionDays: number;
  contents: Content[];
  tasks: Task[];
  recipients: Recipient[];
  bindings: Binding[];
  holidays: Holiday[];
  replies: Record<CommandName, CommandReply>;
  festivals: Festival[];
};
export type Snapshot = { revision: number; botId: string; config: Config };
export type Plan = { due: number; eventKey: string | null };
export type Due = {
  key?: string | null;
  id: string;
  task_id: string;
  recipient_id: string;
  due_at: number;
  event_key: string | null;
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
  | "skipped_duplicate"
  | "skipped_budget";
export type Rendered = {
  format: MessageFormat;
  text: string;
  items: { contentId: string; reason: string }[];
};
export type SourceKind = "official" | "festival";
export type Source = {
  kind: SourceKind;
  year: number;
  hash: string;
  data: string;
  error: string | null;
  updated_at: number;
};
export const LIMITS = {
  tasks: 20,
  recipients: 50,
  bindings: 100,
  contents: 60,
  holidays: 600,
  bodyBytes: 256_000,
  backupBytes: 8_000_000,
  batch: 5,
  concurrency: 2,
  reserveMs: 21_000,
  requestBudgetMs: 20_000,
};
