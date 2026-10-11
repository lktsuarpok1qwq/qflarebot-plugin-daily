import type { ModuleAPI } from "../contract.js";
import { install, snapshot, backup } from "./repository.js";
import { queryWeather } from "./service.js";
import { api } from "./admin.js";
import { weatherPage } from "./ui/page.js";
import { weatherSettings } from "./ui/settings.js";
import { weatherCopyPage } from "./ui/copy.js";
export const weather: ModuleAPI = {
    id: "weather",
    install,
    commands: (execute) => ({
        天气: {
            description: "查询城市天气",
            scenes: ["group", "c2c"],
            handler: (input) =>
                execute(input, "天气", async () => queryWeather(await snapshot(input.ctx.db), input.args)),
        },
    }),
    routes: (["GET", "POST"] as const).map((method) => ({
        method,
        path: "/api/weather/:action",
        auth: "admin" as const,
        handler: api,
    })),
    ui: {
        title: "天气",
        source: [weatherPage, weatherSettings, weatherCopyPage].join("\n"),
        factory: "createWeatherPage",
    },
    backup,
};
