import type { T2IRequest, RenderElement } from "../../../shared/t2i/index.js";
import type { WeatherCardData, WeatherCardCopy } from "./copy.js";
import { WEATHER_REGIONS } from "./layout.js";
import { WEATHER_SYMBOLS, weatherTheme } from "./conditions.js";
function substitute(body: string, data: WeatherCardData) {
    return body.replace(/\{\{([^{}]+)\}\}/g, (_, key: string) => data.values[key] ?? "");
}
export function weatherCardRequest(data: WeatherCardData, copy: WeatherCardCopy): T2IRequest {
    const theme = weatherTheme(data.code, data.night);
    const dark = ["rainy", "heavy-rain", "thunderstorm", "clear-night", "cloudy-night"].includes(theme);
    const foreground = dark ? "#ffffff" : "#092754", panel = "#092754";
    const elements: RenderElement[] = [];
    function text(region: keyof typeof WEATHER_REGIONS, body: string, size: number, color: string, align: "left" | "center" = "left", lineHeight = size + 6) {
        const content = substitute(body, data);

        if (!content) { return; }

        const bounds = WEATHER_REGIONS[region];
        elements.push({ type: "text", region, text: content, x: align === "center" ? bounds.width / 2 : 2, y: 0, size, weight: 400, color, align, maxWidth: bounds.width - 4, lineHeight });
    }
    text("city", copy.city, 28, foreground);
    text("area", copy.area, 24, foreground, "left", 26);
    text("temperature", data.tomorrow ? copy.tomorrow : copy.current, data.tomorrow ? 40 : 64, foreground);
    text("condition", copy.condition, 28, foreground);
    text("first", data.tomorrow ? copy.minimum : copy.feels, 24, panel, "center", 32);
    text("humidity", copy.humidity, 24, panel, "center", 32);
    text("wind", copy.wind, 24, panel, "center", 32);
    text("range", copy.range, 24, panel);
    text("day", copy.day, 24, panel, "center", 70);
    text("night", copy.night, 24, panel, "center", 70);

    for (const [region, code, night] of [["day", data.dayCode, false], ["night", data.nightCode, true]] as const) {
        elements.push({ type: "emoji", region, value: WEATHER_SYMBOLS[weatherTheme(code, night)], x: 94, y: 33, size: 32 });
    }

    text("date", copy.date, 24, foreground);
    return { background: theme, elements };
}
