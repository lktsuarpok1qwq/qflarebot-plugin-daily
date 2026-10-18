import { textLayout } from "../../../shared/cards/layout.js";
import { weatherCardValue } from "./values.js";
import { WEATHER_REGIONS, weatherHeaderColor } from "./layout.js";
import { weatherTheme } from "./conditions.js";
import type { WeatherCardData, WeatherCardCopy } from "./copy.js";
export function layoutWeather(data: WeatherCardData, copy: WeatherCardCopy) {
    const theme = weatherTheme(data.code, data.night), header = weatherHeaderColor(theme), layout = textLayout();

    for (const region of WEATHER_REGIONS) {
        layout.add(region, weatherCardValue(region.field, data, copy), region.color === "header" ? header : "#092754");
    }

    return { background: `weather-${theme}-v1.webp`, layout: layout.finish() };
}
