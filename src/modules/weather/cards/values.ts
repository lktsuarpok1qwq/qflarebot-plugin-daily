import { expand } from "../../../shared/interpolation.js";
import { WEATHER_SYMBOLS, weatherTheme } from "./conditions.js";
import type { WeatherCardCopy, WeatherCardData } from "./copy.js";

export type WeatherCardField = Exclude<keyof WeatherCardCopy, "current" | "feels" | "caption"> | "temperature" | "first" | "day_icon" | "night_icon" | "icon";

export function weatherCardValue(field: WeatherCardField, data: WeatherCardData, copy: WeatherCardCopy): string {
    switch (field) {
        case "temperature": return expand(copy.current, {}, data.values);
        case "first": return expand(copy.feels, {}, data.values);
        case "day_icon": return WEATHER_SYMBOLS[weatherTheme(data.dayCode, false)];
        case "night_icon": return WEATHER_SYMBOLS[weatherTheme(data.nightCode, true)];
        case "icon": return WEATHER_SYMBOLS[weatherTheme(data.code, data.night)];
        default: return expand(copy[field], {}, data.values);
    }
}
