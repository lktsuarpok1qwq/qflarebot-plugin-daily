import type { ModuleDefinition } from "../../shared/modules.js";
import { install } from "./data/repository.js";
import { dispatch } from "./scheduler/dispatcher.js";
import { maintenance } from "./data/maintenance.js";
import { api } from "./admin.js";
import { notificationPage } from "./ui/page.js";
import { tasksPage } from "./ui/tasks.js";
import { recipientsPage } from "./ui/recipients.js";
import { copyTemplates } from "./ui/copy-templates.js";
import { recordsPage } from "./ui/records.js";
export const notification: ModuleDefinition = {
    id: "notification",
    permissions: ["db", "proactive"],
    install,
    cleanup: (ctx, scheduledAt) => maintenance(ctx, scheduledAt),
    title: "通知",
    cron: {
        send: { cron: "* * * * *", handler: ({ ctx }, { variables }) => dispatch(ctx, variables) },
    },
    admin: (input, { variables }) => api(input, variables),
    ui: {
        get source() { return [notificationPage, tasksPage, recipientsPage, copyTemplates, recordsPage].join("\n"); },
        factory: "createNotificationPage",
    },
};
