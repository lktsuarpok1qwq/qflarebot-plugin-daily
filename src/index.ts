import { definePlugin } from "@qqbot/sdk";
import { install } from "./data/repository.js";
import { dispatch } from "./scheduler/dispatcher.js";
import { maintenance } from "./data/maintenance.js";
import { command } from "./commands.js";
import { executeCommand } from "./content/execute-command.js";
import { modules } from "./modules/index.js";
import { api } from "./admin.js";
import { HTML } from "./ui.js";
export default definePlugin({
    name: "daily",
    displayName: "每日助手",
    description: "定时通知、日历、天气与一言",
    apiVersion: 2,
    permissions: ["db", "net", "proactive", "admin"],
    hooks: {
        onInstall: async (ctx) => {
            await install(ctx);

            for (const module of modules) {
                await module.install(ctx);
            }
        },
    },
    commands: {
        每日: {
            description: "每日助手帮助",
            scenes: ["group", "c2c"],
            handler: (input) => command(input, "每日"),
        },
        ...Object.fromEntries(modules.flatMap((m) => Object.entries(m.commands(executeCommand)))),
    },
    cron: {
        send: { cron: "* * * * *", handler: ({ ctx }) => dispatch(ctx) },
        ...Object.fromEntries(modules.flatMap((m) => Object.entries(m.cron ?? {}))),
        cleanup: {
            cron: "10 16 * * *",
            handler: async ({ ctx, scheduledAt }) => {
                await maintenance(ctx, scheduledAt);
            },
        },
    },
    ui: { path: "/ui/", title: "每日助手", icon: "CalendarDays" },
    routes: [
        ...modules.flatMap((m) => m.routes),
        {
            method: "GET",
            path: "/ui/*",
            auth: "admin",
            handler: () =>
                new Response(HTML, {
                    headers: {
                        "content-type": "text/html; charset=utf-8",
                        "cache-control": "no-store",
                    },
                }),
        },
        ...(["GET", "POST"] as const).map((method) => ({
            method,
            path: "/api/:action",
            auth: "admin" as const,
            handler: api,
        })),
    ],
});
