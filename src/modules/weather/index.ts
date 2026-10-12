import { renderWeather } from "./rendering.js";
import { copyContract, commands } from "./definition.js";
import type { ModuleDefinition } from "../../shared/modules.js";
import { install, snapshot } from "./repository.js";
import { queryWeather } from "./service.js";
import { api } from "./admin.js";
import { weatherPage } from "./ui/page.js";
export const weather: ModuleDefinition = {
    id: "weather",
    title: "天气",
    permissions: ["db", "net"],
    install,
    copy: copyContract,
    commands: { definitions: commands, render: async (input) => queryWeather((await snapshot(input.ctx.db)).config, input.args) },
    admin: api,
    ui: {
        source: `const renderWeatherSample = ${renderWeather.toString()};` + weatherPage,
        sections: [{ id: "settings", title: "接入设置", factory: "createSettingsEditor" }, { id: "copy", title: "文案", factory: "createWeatherCopyEditor" }],
    },
};
