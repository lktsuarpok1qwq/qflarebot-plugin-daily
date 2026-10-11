import { CALENDAR_VERSION, EVENT_LIMIT } from "./types.js";
import { BODY_BYTES } from "../../shared/types.js";
import type { CalendarConfig } from "./types.js";
import { fields, str, bool, list } from "../../shared/validation.js";
import { validDate } from "../../shared/date.js";
import { validateTemplate } from "../../shared/templates.js";
import { calendarCopyVariables } from "./copy-fields.js";
export function validateCalendar(value: unknown): CalendarConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("日历配置必须为对象");
    }

    const c = value as CalendarConfig;
    fields(c, ["schemaVersion", "events", "calendarCopy"]);

    if (c.schemaVersion !== CALENDAR_VERSION) {
        throw new Error("不支持的日历配置版本");
    }

    list(c.events, EVENT_LIMIT, "日历事件");
    const ids = new Set<string>();

    for (const h of c.events) {
        str(h.id, 80, "ID");

        if (!/^[\w-]+$/.test(h.id) || ids.has(h.id)) {
            throw new Error("ID 重复或包含非法字符");
        }

        ids.add(h.id);
        fields(h, ["id", "enabled", "name", "start", "end", "kind", "source", "repeat", "batchId"]);
        bool(h.enabled);
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
            str(h.batchId, 80, "批次标识");
        }
    }

    if (!c.calendarCopy || typeof c.calendarCopy !== "object" || Array.isArray(c.calendarCopy)) {
        throw new Error("缺少日历模块文案");
    }

    fields(c.calendarCopy, Object.keys(calendarCopyVariables));

    for (const [key, variables] of Object.entries(calendarCopyVariables)) {
        const value = c.calendarCopy[key as keyof typeof c.calendarCopy];

        str(value, Infinity, "日历模块文案", true);
        validateTemplate(value, variables);
    }

    if (new TextEncoder().encode(JSON.stringify(c)).length > BODY_BYTES) {
        throw new Error("日历配置总量超限");
    }

    return c;
}

export function applyCalendarEdits(c: CalendarConfig, previous: CalendarConfig) {
    for (const h of c.events) {
        const old = previous.events.find((x) => x.id === h.id);

        if (
            old &&
            old.source === "uapi" &&
            ["name", "start", "end", "kind", "repeat"].some(
                (key) => h[key as keyof typeof h] !== old[key as keyof typeof old],
            )
        ) {
            h.source = "manual";
        }
    }
}
