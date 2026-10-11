import type { Config } from "../types.js";
import { LIMITS, SCHEMA_VERSION } from "../types.js";
import { validDate } from "../scheduler/planner.js";
import { COMMAND_NAMES, replyVariables, REPLY_FIELDS } from "../content/command-templates.js";
import { validateTemplate } from "../content/templates.js";
// Current persisted fields; unsupported fields are not accepted back through imports.
const FIELDS = {
    config: [
        "schemaVersion",
        "paused",
        "retentionDays",
        "tasks",
        "recipients",
        "bindings",
        "events",
        "calendarCopy",
        "replies",
    ],
    recipients: ["id", "scene", "openid", "name", "enabled", "botId"],
    events: ["id", "name", "start", "end", "kind", "source", "repeat", "batchId"],
    tasks: ["id", "name", "enabled", "origin", "schedule", "body"],
    bindings: ["taskId", "recipientId"],
    replies: REPLY_FIELDS,
} as const;
function fields(value: object, allowed: readonly string[]) {
    if (Object.keys(value).some((key) => !allowed.includes(key))) {
        throw new Error("配置包含不支持的字段，请使用新版格式");
    }
}
function list(value: unknown, max: number, label: string): asserts value is Record<string, unknown>[] {
    if (
        !Array.isArray(value) ||
        value.length > max ||
        value.some((v) => !v || typeof v !== "object" || Array.isArray(v))
    ) {
        throw new Error(`${label}格式错误或超过 ${max} 条`);
    }
}
function str(value: unknown, max: number, label: string, empty = false): asserts value is string {
    if (
        typeof value !== "string" ||
        (!empty && !value.trim()) ||
        (max !== Infinity && [...value].length > max) ||
        /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)
    ) {
        throw new Error(`${label}格式或长度错误`);
    }
}
function bool(value: unknown) {
    if (typeof value !== "boolean") {
        throw new Error("启用状态必须为布尔值");
    }
}
function ids(items: { id: string }[]) {
    const set = new Set<string>();

    for (const v of items) {
        str(v.id, 80, "ID");

        if (!/^[\w-]+$/.test(v.id) || set.has(v.id)) {
            throw new Error("ID 重复或包含非法字符");
        }

        set.add(v.id);
    }

    return set;
}
export function validateConfig(value: unknown): Config {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("配置必须为对象");
    }

    const c = value as Config;
    fields(c, FIELDS.config);

    if (c.schemaVersion !== SCHEMA_VERSION) {
        throw new Error("不支持的 schemaVersion");
    }

    bool(c.paused);

    if (![7, 30, 90].includes(c.retentionDays)) {
        throw new Error("保留期应为 7/30/90");
    }

    list(c.tasks, LIMITS.tasks, "任务");
    list(c.recipients, LIMITS.recipients, "目标");
    list(c.bindings, LIMITS.bindings, "绑定");
    list(c.events, LIMITS.events, "日历事件");
    const taskIds = ids(c.tasks),
        recipientIds = ids(c.recipients);
    ids(c.events);
    const platformIds = new Set<string>();

    for (const r of c.recipients) {
        fields(r, FIELDS.recipients);
        bool(r.enabled);
        str(r.name, 80, "目标名称", true);
        str(r.openid, 128, "OpenID");
        str(r.botId, 128, "机器人 ID");

        if (!["group", "c2c"].includes(r.scene) || !/^[\w-]+$/.test(r.openid)) {
            throw new Error("发送目标非法");
        }

        const key = `${r.scene}:${r.openid}`;

        if (platformIds.has(key)) {
            throw new Error("重复发送目标");
        }

        platformIds.add(key);
    }

    for (const t of c.tasks) {
        fields(t, FIELDS.tasks);
        bool(t.enabled);
        str(t.name, 80, "任务名称");
        str(t.body, Infinity, "消息内容", true);

        if (!["system", "manual"].includes(t.origin)) {
            throw new Error("任务来源错误");
        }

        validateTemplate(t.body);
        const s = t.schedule;

        if (!s || !["daily", "weekly", "once"].includes(s.kind) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time)) {
            throw new Error("重复方式或时间错误");
        }

        fields(s, ["kind", "time", ...(s.kind === "weekly" ? ["weekdays"] : s.kind === "once" ? ["date"] : [])]);

        if (
            s.kind === "weekly" &&
            (!Array.isArray(s.weekdays) ||
                !s.weekdays.length ||
                s.weekdays.length > 7 ||
                new Set(s.weekdays).size !== s.weekdays.length ||
                s.weekdays.some((d) => !Number.isInteger(d) || d < 1 || d > 7))
        ) {
            throw new Error("星期应为不重复的 1–7");
        }

        if (s.kind === "once" && !validDate(s.date)) {
            throw new Error("一次性日期错误");
        }
    }

    const pairs = new Set<string>();

    for (const b of c.bindings) {
        fields(b, FIELDS.bindings);
        const key = `${b.taskId}:${b.recipientId}`;

        if (!taskIds.has(b.taskId) || !recipientIds.has(b.recipientId) || pairs.has(key)) {
            throw new Error("绑定引用错误或重复");
        }

        pairs.add(key);
    }

    for (const h of c.events) {
        fields(h, FIELDS.events);
        str(h.name, 80, "事件名称");

        if (!["uapi", "manual"].includes(h.source)) {
            throw new Error("事件来源错误");
        }

        if (
            !validDate(h.start) ||
            !validDate(h.end) ||
            h.end < h.start ||
            !["holiday", "makeup", "reference", "event"].includes(h.kind) ||
            (h.kind !== "holiday" && h.start !== h.end)
        ) {
            throw new Error("事件日期错误");
        }

        if (
            !["once", "yearly"].includes(h.repeat) ||
            (h.repeat === "yearly" && (h.kind !== "event" || h.source !== "manual"))
        ) {
            throw new Error("只有人工节日支持每年重复");
        }

        if (h.kind === "event" && h.source !== "manual") {
            throw new Error("自定义节日须为人工来源");
        }

        if (h.batchId !== undefined) {
            str(h.batchId, 80, "导入批次");
        }
    }

    const calendarFields = [
        "summary",
        "event",
        "eventToday",
        "remaining",
        "reference",
        "today",
        "makeupToday",
        "ordinary",
        "unknown",
        "none",
        "ongoing",
        "stale",
    ];

    if (!c.calendarCopy || typeof c.calendarCopy !== "object") {
        throw new Error("缺少日历模块文案");
    }

    fields(c.calendarCopy, calendarFields);

    for (const key of calendarFields) {
        const value = c.calendarCopy[key as keyof typeof c.calendarCopy];
        str(value, Infinity, "日历模块文案", true);
        validateTemplate(
            value,
            key === "summary"
                ? ["name", "start", "end", "days_until", "days_off", "ongoing"]
                : ["reference", "event"].includes(key)
                  ? ["name", "date", "days_until"]
                  : ["today", "makeupToday", "eventToday"].includes(key)
                    ? ["name"]
                    : key === "remaining"
                      ? ["items", "stale", "count", "year", "today"]
                      : [],
        );
    }

    if (!c.replies || typeof c.replies !== "object" || Array.isArray(c.replies)) {
        throw new Error("缺少新版命令回复配置");
    }

    fields(c.replies, COMMAND_NAMES);

    for (const name of COMMAND_NAMES) {
        const reply = c.replies[name];

        if (!reply || typeof reply !== "object") {
            throw new Error("命令回复格式错误");
        }

        fields(reply, FIELDS.replies);

        for (const field of REPLY_FIELDS) {
            str(reply[field], Infinity, "命令回复", ["stale", "ongoing"].includes(field));
            validateTemplate(reply[field], replyVariables(name, field));
        }
    }

    if (new TextEncoder().encode(JSON.stringify(c)).length > LIMITS.bodyBytes) {
        throw new Error("配置总量超限");
    }

    return c;
}
