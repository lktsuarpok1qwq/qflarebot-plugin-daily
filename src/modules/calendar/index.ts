import type { ModuleAPI } from "../contract.js";
import { install, readData } from "./repository.js";
import {
    calendarVariables,
    calendarVariableDescriptions,
    calendarVariableGroups,
    calendarValues,
} from "./placeholders.js";
import { calendarCommands } from "./commands.js";
import { maintenance } from "./maintenance.js";
import { api } from "./admin.js";
import { backup } from "./backup.js";
import { calendarPage } from "./ui/page.js";
import { calendarEntries } from "./ui/entries.js";
import { calendarCopyPage } from "./ui/copy.js";
export const calendar: ModuleAPI = {
    id: "calendar",
    install,
    variables: calendarVariables,
    variableDescriptions: calendarVariableDescriptions,
    variableGroups: calendarVariableGroups,
    createResolver(ctx) {
        let data: ReturnType<typeof readData> | undefined;
        return async (at) => {
            data ??= readData(ctx.db);
            const { snapshot, sources } = await data;
            return calendarValues(snapshot.config, sources, at);
        };
    },
    commands: calendarCommands,
    cron: {
        calendar_sync: {
            cron: "0,1 16 * * *",
            handler: async ({ ctx, scheduledAt }) => {
                await maintenance(ctx, "sync", scheduledAt, false, new Date(scheduledAt).getUTCMinutes() as 0 | 1);
            },
        },
        calendar_cleanup: {
            cron: "10 16 * * *",
            handler: async ({ ctx, scheduledAt }) => {
                await maintenance(ctx, "cleanup", scheduledAt);
            },
        },
    },
    routes: (["GET", "POST"] as const).map((method) => ({
        method,
        path: "/api/calendar/:action",
        auth: "admin" as const,
        handler: api,
    })),
    ui: {
        title: "日历",
        source: [calendarPage, calendarEntries, calendarCopyPage].join("\n"),
        factory: "createCalendarPage",
    },
    backup,
};
