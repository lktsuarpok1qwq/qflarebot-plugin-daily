import { SCHEMA_VERSION, type Config } from "../types.js";
import { COPY } from "../copy.js";
import { validateTemplate as validateSyntax } from "../shared/templates.js";
import { defaultReplies } from "./command-templates.js";
import { moduleVariables, moduleVariableDescriptions, moduleVariableGroups } from "../modules/index.js";
export const VARIABLE_GROUPS = [{ label: "通用", variables: ["日期", "星期"] }, ...moduleVariableGroups];
export const VARIABLES = ["日期", "星期", ...moduleVariables] as const;
export const VARIABLE_DESCRIPTIONS = {
    日期: "发送日期",
    星期: "发送日期对应的星期",
    ...moduleVariableDescriptions,
};
export const validateTemplate = (body: string, keys: readonly string[] = VARIABLES) => validateSyntax(body, keys);
export function defaults(): Config {
    return {
        schemaVersion: SCHEMA_VERSION,
        paused: false,
        retentionDays: 30,
        tasks: [
            {
                id: "daily-announcement",
                name: COPY.announcement.name,
                templateId: "daily-announcement",
                enabled: false,
                origin: "system",
                schedule: { kind: "daily", time: "09:00" },
            },
        ],
        templates: [{ id: "daily-announcement", ...COPY.announcement }],
        recipients: [],
        bindings: [],
        replies: defaultReplies(),
        commandFeedback: structuredClone(COPY.commandFeedback),
    };
}
