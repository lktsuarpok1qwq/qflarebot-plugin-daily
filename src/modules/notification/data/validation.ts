import { fields, list, str, bool } from "../../../shared/validation.js";
import type { Config } from "../types.js";
import { LIMITS, SCHEMA_VERSION, RETENTION_DAYS } from "../types.js";
import { validDate } from "../../../shared/date.js";
import { validateCopyText } from "../../../shared/templates.js";
const FIELDS = {
    config: [
        "schemaVersion",
        "paused",
        "retentionDays",
        "tasks",
        "templates",
        "recipients",
        "bindings",
    ],
    recipients: ["id", "scene", "openid", "name", "enabled", "botId"],
    templates: ["id", "name", "body"],
    tasks: ["id", "name", "enabled", "origin", "schedule", "templateId"],
    bindings: ["taskId", "recipientId"],
} as const;
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
export function validateConfig(value: unknown, variables: readonly string[]): Config {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("配置必须为对象");
    }

    const c = value as Config;
    fields(c, FIELDS.config);

    if (c.schemaVersion !== SCHEMA_VERSION) {
        throw new Error("不支持的 schemaVersion");
    }

    bool(c.paused);

    if (!RETENTION_DAYS.includes(c.retentionDays)) {
        throw new Error("保留期应为 7/30/90");
    }

    list(c.tasks, LIMITS.tasks, "任务");
    list(c.templates, LIMITS.templates, "文案模板");
    const templateIds = ids(c.templates);

    for (const template of c.templates) {
        fields(template, FIELDS.templates);
        str(template.name, 80, "模板名称");
        validateCopyText(template.body, { label: "模板内容", variables, allowEmpty: true });
    }

    list(c.recipients, LIMITS.recipients, "目标");
    list(c.bindings, LIMITS.bindings, "绑定");
    const taskIds = ids(c.tasks),
        recipientIds = ids(c.recipients);
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

        if (!templateIds.has(t.templateId)) {
            throw new Error("任务引用的文案模板不存在，请先选择有效模板");
        }

        if (!["system", "manual"].includes(t.origin)) {
            throw new Error("任务来源错误");
        }

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

    if (new TextEncoder().encode(JSON.stringify(c)).length > LIMITS.bodyBytes) {
        throw new Error("配置总量超限");
    }

    return c;
}
