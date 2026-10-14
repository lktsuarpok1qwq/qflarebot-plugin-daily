import { createT2I, type T2IService, type T2IAssets } from "../../../shared/t2i/index.js";
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
let current: { theme: WeatherTheme; renderer: T2IService } | undefined;
export async function renderWeatherCard(data: WeatherCardData, copy: WeatherCardCopy) {
    const request = weatherCardRequest(data, copy), theme = request.background as WeatherTheme;
    let selected = current;

    if (selected?.theme !== theme) {
        const background = (await backgrounds[theme]()).default;
        selected = { theme, renderer: createT2I({ backgrounds: { [theme]: background }, fonts: fonts as T2IAssets["fonts"], emoji, icons: {} }) };
        current = selected;
    }

    return selected.renderer.render(request);
}
