import { type SettingsDeclaration } from "../../shared/declarations.js";
import { RETENTION_DAYS } from "./types.js";

export const settings: SettingsDeclaration = {
    id: "notification-settings", title: "记录设置",
    fields: [{ key: "retentionDays", id: "retention", label: "日志保留天数", type: "select", valueType: "number", options: RETENTION_DAYS.map((days) => ({ id: String(days), name: String(days) })) }],
};
