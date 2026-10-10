import type { Config } from "../types.js";
import { LIMITS } from "../types.js";
import { validDate } from "../scheduler/planner.js";
import { validateTemplate } from "../content/templates.js";
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
// Accept older backups/configurations without retaining the retired selectors.
export function normalizeConfig(config: Config): Config {
  const legacy = config as Config & { regions?: unknown; coverage?: unknown };
  delete legacy.regions;
  delete legacy.coverage;
  for (const item of [
    ...(config.holidays ?? []),
    ...(config.contents ?? []),
    ...(config.tasks ?? []).map((t) => t.schedule),
  ]) {
    if (!item || typeof item !== "object") continue;
    const old = item as { region?: unknown; verified?: unknown };
    delete old.region;
    delete old.verified;
  }
  return config;
}
export function validateConfig(value: unknown): Config {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("配置必须为对象");
  const c = normalizeConfig(value as Config);
  if (c.schemaVersion !== 1) throw new Error("不支持的 schemaVersion");
  bool(c.paused);
  if (
    ![7, 30, 90].includes(c.retentionDays) ||
    !Number.isInteger(c.textLimit) ||
    c.textLimit < 100 ||
    c.textLimit > 500
  )
    throw new Error("保留期应为 7/30/90，应用文本上限应为 100–500");
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
    bool(x.enabled);
    str(x.name, 80, "内容名称");
    str(x.body, c.textLimit, "内容", true);
    if (
      !["text", "date", "holiday"].includes(x.kind) ||
      (x.only && !["always", "holiday", "makeup"].includes(x.only))
    )
      throw new Error("内容类型非法");
    validateTemplate(x.body, c.textLimit);
  }
  for (const t of c.tasks) {
    bool(t.enabled);
    str(t.name, 80, "任务名称");
    str(t.title, 80, "标题", true);
    str(t.separator, 10, "分隔符", true);
    validateTemplate(t.title, c.textLimit);
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
      (!["holiday", "makeup"].includes(s.eventKind ?? "") ||
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
      c.textLimit,
    );
  }
  const pairs = new Set<string>();
  for (const b of c.bindings) {
    bool(b.enabled);
    const key = `${b.taskId}:${b.recipientId}`;
    if (
      !taskIds.has(b.taskId) ||
      !recipientIds.has(b.recipientId) ||
      pairs.has(key)
    )
      throw new Error("绑定引用错误或重复");
    pairs.add(key);
    if (b.overrideText !== null) {
      str(b.overrideText, c.textLimit, "覆盖文字");
      validateTemplate(b.overrideText, c.textLimit);
    }
  }
  for (const h of c.holidays) {
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
    if (h.sourceHash !== undefined) str(h.sourceHash, 64, "源指纹");
    if (h.batchId !== undefined) str(h.batchId, 80, "导入批次");
  }
  if (!c.help) throw new Error("缺少帮助");
  str(c.help.daily, c.textLimit, "每日帮助");
  str(c.help.holiday, c.textLimit, "假期帮助");
  for (const text of [c.help.daily, c.help.holiday])
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text))
      throw new Error("帮助包含控制字符");
  if (new TextEncoder().encode(JSON.stringify(c)).length > LIMITS.bodyBytes)
    throw new Error("配置总量超限");
  return c;
}
