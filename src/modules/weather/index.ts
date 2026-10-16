import { backgrounds } from "./cards/backgrounds/index.js";
import { bindCards } from "../../shared/cards/store.js";
import { weatherDesigns } from "./cards/design.js";
import { renderWeather } from "./rendering.js";
import { copyContract, commands } from "./definition.js";
import type { ModuleDefinition } from "../../shared/modules.js";
import { install, snapshot, save, readHelp } from "./repository.js";
import { renderWeatherCommand } from "./cards/command.js";
import { weatherCardRoutes, cleanupWeatherImages } from "./cards/media.js";
import { api } from "./admin.js";
import { weatherPage } from "./ui/page.js";
export const weather: ModuleDefinition = {
    id: "weather", cards: bindCards(weatherDesigns, { snapshot, save }, backgrounds, "jpeg"),
    title: "天气",
    permissions: ["db", "net"],
    install,
    routes: weatherCardRoutes,
    cleanupImages: cleanupWeatherImages,
    copy: copyContract,
    commands: {
        definitions: commands, render: async (input) => {
            if (!input.args.length || (input.args.length === 1 && input.args[0] === "明天")) { return { text: await readHelp(input.ctx.db) }; }

            return renderWeatherCommand(input, (await snapshot(input.ctx.db)).config);
        }
    },
    admin: api,
    ui: {
        get source() { return `const renderWeatherSample = ${renderWeather.toString()};` + weatherPage; },
        sections: [{ id: "settings", title: "接入设置", factory: "createSettingsEditor" }, { id: "cards", title: "卡面", factory: "createCardEditor" }, { id: "copy", title: "文案", factory: "createWeatherCopyEditor" }],
    },
};
