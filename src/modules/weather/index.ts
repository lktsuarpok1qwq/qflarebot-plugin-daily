import { renderWeather } from "./rendering.js";
import { commands } from "./definition.js";
import { registerCommands } from "../../shared/declarations.js";
import type { ModuleAPI } from "../contract.js";
import { install, snapshot } from "./repository.js";
import { queryWeather } from "./service.js";
import { api } from "./admin.js";
import { weatherPage } from "./ui/page.js";
export const weather: ModuleAPI = {
    id: "weather",
    install,
    commands: (execute) => registerCommands(commands, execute, async (input) => queryWeather((await snapshot(input.ctx.db)).config, input.args)),
    admin: api,
    ui: {
        title: "天气",
        source: `const renderWeatherSample = ${renderWeather.toString()};` + weatherPage,
        factory: "createWeatherPage",
    },
};
