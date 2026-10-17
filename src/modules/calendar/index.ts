import { copyContract } from "./definition.js";
import { sampleVariables } from "./samples.js";
import { renderCalendarDocument } from "./rendering.js";
import type { ModuleDefinition } from "../../shared/modules.js";
import { install, readQueryData } from "./repository.js";
import { calendarVariables } from "./copy.js";
import { calendarValues } from "./placeholders.js";
import { calendarCommands } from "./commands.js";
import { maintenance } from "./maintenance.js";
import { api } from "./admin.js";
import { calendarPage } from "./ui/page.js";
import { calendarEntries } from "./ui/entries.js";
export const calendar: ModuleDefinition = {
    id: "calendar",
    title: "日历",
    permissions: ["db", "net"],
    install,
    cleanup: (ctx, scheduledAt) => maintenance(ctx, "cleanup", scheduledAt),
    copy: copyContract,
    variables: {
        ...calendarVariables,
        sampleVariables,
        createResolver(ctx) {
            let data: ReturnType<typeof readQueryData> | undefined;
            return async (at) => {
                data ??= readQueryData(ctx.db);
                const { snapshot, sources } = await data;
                return calendarValues(snapshot.config, sources, at);
            };
        },
    },
    commands: calendarCommands,
    maintenance: {
        calendar_sync: {
            utcMinutes: [16 * 60, 16 * 60 + 1],
            handler: async ({ ctx, scheduledAt }) => {
                const result = await maintenance(ctx, "sync", scheduledAt, false, new Date(scheduledAt).getUTCMinutes() as 0 | 1);

                if (!result.ok) { throw new Error(result.message); }
            },
        },
    },
    admin: api,
    ui: {
        get source() { return [`const renderCalendarSample = ${renderCalendarDocument.toString()};`, calendarPage, calendarEntries].join("\n"); },
        sections: [{ id: "entries", title: "日历条目", factory: "createCalendarEntries" }, { id: "copy", title: "文案", factory: "createCalendarCopyEditor" }],
    },
};
