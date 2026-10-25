import { SCHEMA_VERSION, type Config } from "../types.js";
import { COPY } from "../copy.js";

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
    };
}
