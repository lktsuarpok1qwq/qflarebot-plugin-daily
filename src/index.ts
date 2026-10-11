import { definePlugin } from "@qqbot/sdk";
import { defaults } from "./data/repository.js";
import { installState } from "./shared/state.js";
import { coreCommands, moduleCommands } from "./commands.js";
import { modules } from "./modules/index.js";
import { api } from "./admin.js";
import { HTML } from "./ui/index.js";
export default definePlugin({
    name: "daily",
    displayName: "每日助手",
    description: "定时通知、日历、天气与一言",
    apiVersion: 2,
    permissions: ["db", "net", "proactive", "admin"],
    hooks: {
        onInstall: async (ctx) => {
            await installState(ctx, Object.assign(defaults(), ...modules.map((m) => m.initialConfig?.() ?? {})));

            for (const module of modules) {
                await module.install(ctx);
            }
        },
    },
    commands: {
        ...coreCommands,
        ...moduleCommands,
    },
    cron: Object.fromEntries(modules.flatMap((m) => Object.entries(m.cron ?? {}))),
    ui: { path: "/ui/", title: "每日助手", icon: "CalendarDays" },
    routes: [
        ...modules.flatMap((m) => (["GET", "POST"] as const).map((method) => ({
            method, path: `/api/${m.id}/:action`, auth: "admin" as const, handler: m.admin,
        }))),
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
