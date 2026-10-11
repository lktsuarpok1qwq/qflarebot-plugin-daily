import type { ModuleAPI } from "../contract.js";
import type { VariableAPI } from "../../shared/variables.js";
import { install } from "./data/repository.js";
import { defaults } from "./content/templates.js";
import { dispatch } from "./scheduler/dispatcher.js";
import { maintenance } from "./data/maintenance.js";
import { api } from "./admin.js";
import { notificationPage } from "./ui/page.js";
import { tasksPage } from "./ui/tasks.js";
import { recipientsPage } from "./ui/recipients.js";
import { copyTemplates } from "./ui/copy-templates.js";
import { recordsPage } from "./ui/records.js";
export function createNotification(variables: VariableAPI): ModuleAPI {
    return {
        id: "notification",
        install,
        initialConfig: defaults,
        cron: {
            send: { cron: "* * * * *", handler: ({ ctx }) => dispatch(ctx, variables) },
            cleanup: { cron: "10 16 * * *", handler: async ({ ctx, scheduledAt }) => { await maintenance(ctx, scheduledAt); } },
        },
        admin: (input) => api(input, variables),
        ui: {
            title: "通知",
            source: [notificationPage, tasksPage, recipientsPage, copyTemplates, recordsPage].join("\n"),
            factory: "createNotificationPage",
        },
    };
}
