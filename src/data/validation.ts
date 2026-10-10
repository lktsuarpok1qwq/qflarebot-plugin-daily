import type { Config } from "../types.js";
import { LIMITS } from "../types.js";
import { validDate } from "../scheduler/planner.js";
import {
  COMMAND_NAMES,
  replyVariables,
  REPLY_FIELDS,
} from "../content/command-templates.js";
import { validateTemplate } from "../content/templates.js";
// Current persisted fields; unsupported fields are not accepted back through imports.
const FIELDS = {
  config: [
    "schemaVersion",
    "paused",
    "retentionDays",
    "contents",
    "tasks",
    "recipients",
    "bindings",
    "holidays",
    "replies",
    "festivals",
  ],
  contents: ["id", "name", "enabled", "kind", "body", "referenceBody", "only"],
  recipients: ["id", "scene", "openid", "name", "enabled", "botId"],
  holidays: [
    "id",
    "name",
    "start",
    "end",
    "kind",
    "source",
    "manual",
    "sourceHash",
    "batchId",
    "festivalIds",
  ],
  festivals: ["id", "key", "name", "date", "source", "manual"],
  tasks: [
    "id",
    "name",
    "enabled",
    "mode",
    "format",
    "schedule",
    "contentIds",
    "title",
    "separator",
  ],
  schedule: [
    "kind",
    "time",
    "weekdays",
    "date",
    "monthDay",
    "eventKind",
    "offset",
  ],
  bindings: [
    "taskId",
    "recipientId",
    "enabled",
    "overrideText",
    "overrideFormat",
  ],
  replies: ["format", ...REPLY_FIELDS],
} as const;
function fields(value: object, allowed: readonly string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new Error("配置包含不支持的字段，请使用新版格式");
}
function list(
  value: unknown,
  max: number,
  label: string,
): asserts value is Record<string, unknown>[] {
  if (
    !Array.isArray(value) ||
    value.length > max ||
    value.some((v) => !v || typeof v !== "object" || Array.isArray(v))
  )
    throw new Error(`${label}格式错误或超过 ${max} 条`);
}
function str(
  value: unknown,
  max: number,
  label: string,
  empty = false,
): asserts value is string {
  if (
    typeof value !== "string" ||
    (!empty && !value.trim()) ||
    [...value].length > max ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)
  )
    throw new Error(`${label}格式或长度错误`);
}
function bool(value: unknown) {
  if (typeof value !== "boolean") throw new Error("启用状态必须为布尔值");
}
function ids(items: { id: string }[]) {
  const set = new Set<string>();
  for (const v of items) {
    str(v.id, 80, "ID");
    if (!/^[\w-]+$/.test(v.id) || set.has(v.id))
      throw new Error("ID 重复或包含非法字符");
    set.add(v.id);
  }
  return set;
}
export function validateConfig(value: unknown): Config {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("配置必须为对象");
  const c = value as Config;
  fields(c, FIELDS.config);
  if (c.schemaVersion !== 1) throw new Error("不支持的 schemaVersion");
  bool(c.paused);
  if (![7, 30, 90].includes(c.retentionDays))
    throw new Error("保留期应为 7/30/90");
  list(c.tasks, LIMITS.tasks, "任务");
  list(c.contents, LIMITS.contents, "内容");
  list(c.recipients, LIMITS.recipients, "目标");
  list(c.bindings, LIMITS.bindings, "绑定");
  list(c.holidays, LIMITS.holidays, "假期");
  const taskIds = ids(c.tasks),
    contentIds = ids(c.contents),
    recipientIds = ids(c.recipients);
  ids(c.holidays);
  const platformIds = new Set<string>();
  for (const r of c.recipients) {
    fields(r, FIELDS.recipients);
    bool(r.enabled);
    str(r.name, 80, "目标名称", true);
    str(r.openid, 128, "OpenID");
    str(r.botId, 128, "机器人 ID");
    if (!["group", "c2c"].includes(r.scene) || !/^[\w-]+$/.test(r.openid))
      throw new Error("发送目标非法");
    const key = `${r.scene}:${r.openid}`;
    if (platformIds.has(key)) throw new Error("重复发送目标");
    platformIds.add(key);
  }
  for (const x of c.contents) {
    fields(x, FIELDS.contents);
    bool(x.enabled);
    str(x.name, 80, "内容名称");
    str(x.body, Infinity, "内容", true);
    if (
      !["text", "date", "holiday"].includes(x.kind) ||
      (x.only && !["always", "holiday", "makeup"].includes(x.only))
    )
      throw new Error("内容类型非法");
    validateTemplate(x.body);
    if (x.referenceBody !== undefined) {
      str(x.referenceBody, Infinity, "日期参考模板", true);
      validateTemplate(x.referenceBody);
    }
  }
  for (const t of c.tasks) {
    fields(t, FIELDS.tasks);
    bool(t.enabled);
    str(t.name, 80, "任务名称");
    str(t.title, Infinity, "标题", true);
    str(t.separator, Infinity, "分隔符", true);
    validateTemplate(t.title);
    if (!["plain", "markdown"].includes(t.format))
      throw new Error("消息格式错误");
    if (
      !["standalone", "digest"].includes(t.mode) ||
      !Array.isArray(t.contentIds) ||
      !t.contentIds.length ||
      t.contentIds.length > 20 ||
      new Set(t.contentIds).size !== t.contentIds.length ||
      t.contentIds.some((id) => !contentIds.has(id))
    )
      throw new Error("任务内容引用错误");
    if (t.mode === "standalone" && t.contentIds.length !== 1)
      throw new Error("独立任务必须选择一项内容");
    const s = t.schedule;
    if (
      !s ||
      !["daily", "weekly", "once", "yearly", "holiday_event"].includes(
        s.kind,
      ) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time)
    )
      throw new Error("周期或时间错误");
    fields(s, FIELDS.schedule);
    if (
      s.kind === "weekly" &&
      (!Array.isArray(s.weekdays) ||
        !s.weekdays.length ||
        s.weekdays.length > 7 ||
        s.weekdays.some((d) => !Number.isInteger(d) || d < 1 || d > 7))
    )
      throw new Error("星期应为 1–7");
    if (s.kind === "once" && !validDate(s.date ?? ""))
      throw new Error("一次性日期错误");
    if (s.kind === "yearly" && !validDate(`2000-${s.monthDay}`))
      throw new Error("年度月日错误");
    if (
      s.kind === "holiday_event" &&
      (!["holiday", "makeup", "festival"].includes(s.eventKind ?? "") ||
        !Number.isInteger(s.offset) ||
        s.offset! < 0 ||
        s.offset! > 366)
    )
      throw new Error("假期周期参数错误");
    validateTemplate(
      [
        t.title,
        ...t.contentIds.map((id) => c.contents.find((x) => x.id === id)!.body),
      ]
        .filter(Boolean)
        .join(t.separator),
    );
  }
  const pairs = new Set<string>();
  for (const b of c.bindings) {
    fields(b, FIELDS.bindings);
    bool(b.enabled);
    if (!["plain", "markdown"].includes(b.overrideFormat))
      throw new Error("覆盖格式错误");
    const key = `${b.taskId}:${b.recipientId}`;
    if (
      !taskIds.has(b.taskId) ||
      !recipientIds.has(b.recipientId) ||
      pairs.has(key)
    )
      throw new Error("绑定引用错误或重复");
    pairs.add(key);
    if (b.overrideText !== null) {
      str(b.overrideText, Infinity, "覆盖文字");
      validateTemplate(b.overrideText);
    }
  }
  for (const h of c.holidays) {
    fields(h, FIELDS.holidays);
    str(h.name, 80, "假期名称");
    h.source ||= "manual";
    str(h.source, 500, "来源", true);
    if (h.manual !== undefined) bool(h.manual);
    if (
      !validDate(h.start) ||
      !validDate(h.end) ||
      h.end < h.start ||
      !["holiday", "makeup"].includes(h.kind) ||
      (h.kind === "makeup" && h.start !== h.end)
    )
      throw new Error("假期日期错误");
    if (
      h.festivalIds !== undefined &&
      (!Array.isArray(h.festivalIds) ||
        h.festivalIds.some(
          (id) => typeof id !== "string" || !/^festival-\d{4}-[a-z]+$/.test(id),
        ))
    )
      throw new Error("假期节日标识错误");
    if (h.sourceHash !== undefined) str(h.sourceHash, 64, "源指纹");
    if (h.batchId !== undefined) str(h.batchId, 80, "导入批次");
  }
  list(c.festivals, 100, "节日日期");
  ids(c.festivals);
  for (const f of c.festivals) {
    fields(f, FIELDS.festivals);
    str(f.name, 80, "节日名称");
    str(f.key, 80, "节日标识");
    str(f.source, 500, "节日来源");
    if (!validDate(f.date)) throw new Error("节日日期错误");
    if (f.manual !== undefined) bool(f.manual);
  }
  if (!c.replies || typeof c.replies !== "object" || Array.isArray(c.replies))
    throw new Error("缺少新版命令回复配置");
  fields(c.replies, COMMAND_NAMES);
  for (const name of COMMAND_NAMES) {
    const reply = c.replies[name];
    if (!reply || !["plain", "markdown"].includes(reply.format))
      throw new Error("命令回复格式错误");
    fields(reply, FIELDS.replies);
    for (const field of REPLY_FIELDS) {
      str(
        reply[field],
        Infinity,
        "命令回复",
        ["stale", "ongoing", "separator"].includes(field),
      );
      validateTemplate(reply[field], replyVariables(name, field));
    }
  }
  if (new TextEncoder().encode(JSON.stringify(c)).length > LIMITS.bodyBytes)
    throw new Error("配置总量超限");
  return c;
}
