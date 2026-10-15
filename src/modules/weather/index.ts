import { backgrounds } from "./cards/backgrounds/index.js";
import { bindCards } from "../../shared/cards/store.js";
import { weatherDesigns } from "./cards/design.js";
import { renderWeather } from "./rendering.js";
import { copyContract, commands } from "./definition.js";
import type { ModuleDefinition } from "../../shared/modules.js";
import { install, snapshot, save } from "./repository.js";
import { renderWeatherCommand } from "./cards/command.js";
import { weatherCardRoutes, cleanupWeatherImages } from "./cards/media.js";
import { api } from "./admin.js";
import { weatherPage } from "./ui/page.js";
export const weather: ModuleDefinition = {
    id: "weather", cards: bindCards(weatherDesigns, { snapshot, save }, backgrounds),
    title: "天气",
    permissions: ["db", "net"],
    install,
    routes: weatherCardRoutes,
    cleanup: cleanupWeatherImages,
    copy: copyContract,
    commands: { definitions: commands, render: async (input) => renderWeatherCommand(input, (await snapshot(input.ctx.db)).config) },
    admin: api,
    ui: {
        get source() { return `const renderWeatherSample = ${renderWeather.toString()};` + weatherPage; },
        sections: [{ id: "settings", title: "接入设置", factory: "createSettingsEditor" }, { id: "cards", title: "卡面", factory: "createCardEditor" }, { id: "copy", title: "文案", factory: "createWeatherCopyEditor" }],
    },
};
