import { validateRoutes } from "./shared/routes.js";
import { definePlugin } from "@qqbot/sdk";
import { install } from "./data/repository.js";
import { coreCommands, moduleCommands } from "./commands.js";
import { registry } from "./modules/index.js";
import { api } from "./admin.js";
export default definePlugin({
    name: "daily",
    displayName: "每日助手",
    description: "定时通知、日历、天气、一言与运势",
    apiVersion: 3,
    configSchema: {
        type: "object",
        properties: {
            imagePublicUrl: {
                type: "string", title: "图片公开地址", default: "",
                description: "当前 R2 桶绑定的 HTTPS 自定义域名，如 https://img.example.com，留空使用机器人地址",
            },
        },
    },
    defaultConfig: { imagePublicUrl: "" },
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
    routes: validateRoutes([
        ...registry.routes,
        {
            method: "GET",
            path: "/ui/*",
            auth: "admin",
            handler: async () =>
                new Response((await import("./ui/index.js")).HTML, {
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
    ]),
});
