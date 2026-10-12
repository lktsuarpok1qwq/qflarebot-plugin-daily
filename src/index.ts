import { definePlugin } from "@qqbot/sdk";
import { install } from "./data/repository.js";
import { coreCommands, moduleCommands } from "./commands.js";
import { registry } from "./modules/index.js";
import { api } from "./admin.js";
import { HTML } from "./ui/index.js";
export default definePlugin({
    name: "daily",
    displayName: "每日助手",
    description: "定时通知、日历、天气、一言与运势",
    apiVersion: 2,
    permissions: [...new Set(["db", "admin", ...registry.permissions] as const)],
    hooks: {
        onInstall: async (ctx) => {
            await install(ctx);
            await registry.install(ctx);
        },
    },
    commands: {
        ...coreCommands,
        ...moduleCommands,
    },
    cron: registry.cron,
    ui: { path: "/ui/", title: "每日助手", icon: "CalendarDays" },
    routes: [
        ...registry.routes,
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
