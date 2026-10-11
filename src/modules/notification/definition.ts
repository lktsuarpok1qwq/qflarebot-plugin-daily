import { type SettingsDeclaration } from "../../shared/declarations.js";
export const settings: SettingsDeclaration = {
    id: "notification-settings", title: "记录设置",
    fields: [{ key: "retentionDays", id: "retention", label: "日志保留天数", type: "select", valueType: "number", options: [7, 30, 90].map((days) => ({ id: String(days), name: String(days) })) }],
};
