import type { PluginContext } from "@qqbot/sdk";
export type Ctx = PluginContext;
export type Scene = "group" | "c2c";
export type Schedule = {
  kind: "daily" | "weekly" | "once" | "yearly" | "holiday_event";
  time: string;
  weekdays?: number[];
  date?: string;
  monthDay?: string;
  region?: string;
  eventKind?: "holiday" | "makeup";
  offset?: number;
};
export type Content = {
  id: string;
  name: string;
  enabled: boolean;
  kind: "text" | "date" | "holiday";
  body: string;
  region?: string;
  only?: "always" | "holiday" | "makeup";
};
export type Task = {
  id: string;
  name: string;
  enabled: boolean;
  mode: "standalone" | "digest";
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
};
export type Holiday = {
  id: string;
  region: string;
  name: string;
  start: string;
  end: string;
  kind: "holiday" | "makeup";
  verified: boolean;
  source: string;
  sourceHash?: string;
  batchId?: string;
};
export type Coverage = {
  region: string;
  year: number;
  complete: boolean;
  verifiedAt: string;
};
export type Config = {
  schemaVersion: 1;
  paused: boolean;
  retentionDays: number;
  textLimit: number;
  contents: Content[];
  tasks: Task[];
  recipients: Recipient[];
  bindings: Binding[];
  regions: { id: string; name: string }[];
  holidays: Holiday[];
  coverage: Coverage[];
  help: { daily: string; holiday: string };
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
  text: string;
  items: { contentId: string; reason: string }[];
};
export type Source = {
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
