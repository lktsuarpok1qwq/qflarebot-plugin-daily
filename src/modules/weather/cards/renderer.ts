import { createT2I, type T2IAssets } from "../../../shared/t2i/index.js";
import fonts from "./generated/glyphs.json";
import emoji from "./generated/emoji.js";
import { weatherCardRequest } from "./request.js";
import type { WeatherTheme } from "./conditions.js";
import type { WeatherCardData, WeatherCardCopy } from "./copy.js";
const backgrounds = {
    "sunny": () => import("./generated/sunny.js"),
    "cloudy": () => import("./generated/cloudy.js"),
    "overcast": () => import("./generated/overcast.js"),
    "rainy": () => import("./generated/rainy.js"),
    "heavy-rain": () => import("./generated/heavy-rain.js"),
    "thunderstorm": () => import("./generated/thunderstorm.js"),
    "snowy": () => import("./generated/snowy.js"),
    "sleet": () => import("./generated/sleet.js"),
    "fog": () => import("./generated/fog.js"),
    "haze": () => import("./generated/haze.js"),
    "sand": () => import("./generated/sand.js"),
    "hot": () => import("./generated/hot.js"),
    "cold": () => import("./generated/cold.js"),
    "unknown": () => import("./generated/unknown.js"),
    "clear-night": () => import("./generated/clear-night.js"),
    "cloudy-night": () => import("./generated/cloudy-night.js"),
};
const assets: T2IAssets = { backgrounds: {}, fonts: fonts as T2IAssets["fonts"], emoji, icons: {} };
const renderer = createT2I(assets);
export async function renderWeatherCard(data: WeatherCardData, copy: WeatherCardCopy) {
    const request = weatherCardRequest(data, copy), theme = request.background as WeatherTheme;

    if (!Object.hasOwn(assets.backgrounds, theme)) {
        assets.backgrounds[theme] = (await backgrounds[theme]()).default;
    }

    return renderer.render(request);
}
