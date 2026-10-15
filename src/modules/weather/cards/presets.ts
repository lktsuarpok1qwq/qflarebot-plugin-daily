import type { CardDesign, CardRegion } from "../../../shared/cards/types.js";
import { WEATHER_REGIONS } from "./layout.js";
import { WEATHER_THEMES, type WeatherTheme } from "./conditions.js";
const names = ["晴天", "多云", "阴天", "雨天", "大雨", "雷雨", "雪天", "雨夹雪", "雾", "霾", "沙尘", "高温", "寒冷", "普通", "晴夜", "多云夜晚"];
export function weatherDefault(theme: WeatherTheme, tomorrow = false): CardDesign {
    const dark = ["rainy", "heavy-rain", "thunderstorm", "clear-night", "cloudy-night"].includes(theme);
    const regions: CardRegion[] = Object.entries(WEATHER_REGIONS).filter(([key]) => key !== "symbol").map(([field, bounds]) => {
        const panel = ["first", "humidity", "wind", "range", "day", "night"].includes(field);
        const size = field === "temperature" ? tomorrow ? 40 : 64 : ["city", "condition"].includes(field) ? 28 : 24;
        return { ...bounds, id: field, field, size, color: panel || !dark ? "#092754" : "#ffffff", weight: 400, align: panel && field !== "range" ? "center" : "left", lineHeight: ["day", "night"].includes(field) ? 70 : size + 6 };
    });

    for (const field of ["day", "night"] as const) {
        const bounds = WEATHER_REGIONS[field];
        regions.push({ id: field + "-icon", field: field + "_icon", x: bounds.x + 94, y: bounds.y + 33, width: 32, height: 32, size: 32, lineHeight: 32, weight: 400, color: "#092754", align: "left" });
    }

    return { enabled: true, background: `weather-${theme}-v1.webp`, regions };
}
export const weatherPresets = WEATHER_THEMES.map((theme, index) => ({ id: theme, title: names[index]!, design: weatherDefault(theme) }));
