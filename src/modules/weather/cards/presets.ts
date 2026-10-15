import type { CardDesign } from "../../../shared/cards/types.js";
import { WEATHER_REGIONS, TOMORROW_TEMPERATURE, weatherHeaderColor } from "./layout.js";
import { WEATHER_THEMES, type WeatherTheme } from "./conditions.js";
const names = ["晴天", "多云", "阴天", "雨天", "大雨", "雷雨", "雪天", "雨夹雪", "雾", "霾", "沙尘", "高温", "寒冷", "普通", "晴夜", "多云夜晚"];
export function weatherDefault(theme: WeatherTheme, tomorrow = false): CardDesign {
    const header = weatherHeaderColor(theme);
    return { enabled: true, background: `weather-${theme}-v1.webp`, regions: WEATHER_REGIONS.map(region => ({ ...(tomorrow && region.field === "temperature" ? TOMORROW_TEMPERATURE : region), color: region.color === "header" ? header : "#092754" })) };
}
export const weatherPresets = WEATHER_THEMES.map((theme, index) => ({ id: theme, title: names[index]!, get design() { return weatherDefault(theme); } }));
