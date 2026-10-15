import type { CardDefinition } from "../../../shared/cards/types.js";
import { weatherCardValue } from "./values.js";
import type { WeatherCardCopy, WeatherCardData } from "./copy.js";
import { weatherPresets } from "./presets.js";
export const weatherDesigns: readonly CardDefinition[] = [{
    id: "weather", presets: weatherPresets, samples: [
        { id: "current", title: "当前天气", values: { city: "北京", area: "北京市", temperature: "24℃", condition: "晴", icon: "☀️", first: "体感\n25℃", humidity: "湿度\n42%", wind: "风速\n2.3 m/s", range: "温度范围  15～26℃", day: "白天\n晴", night: "夜间\n多云", day_icon: "☀️", night_icon: "☁️", date: "10月15日" } },
        { id: "tomorrow", title: "明天天气", values: { city: "北京", area: "北京市", temperature: "15～26℃", condition: "晴", icon: "☀️", first: "最低\n15℃", humidity: "湿度\n42%", wind: "风速\n2.3 m/s", range: "温度范围  15～26℃", day: "白天\n晴", night: "夜间\n多云", day_icon: "☀️", night_icon: "☁️", date: "10月16日" } },
    ], title: "天气卡", width: 540, height: 850, fields: [
        { key: "day_icon", label: "白天图标", sample: "🌧️" }, { key: "night_icon", label: "夜间图标", sample: "☁️" },
        { key: "city", label: "城市", sample: "北京" }, { key: "area", label: "所属地区", sample: "北京市" },
        { key: "temperature", label: "温度", sample: "24℃" }, { key: "condition", label: "天气", sample: "小雨" }, { key: "icon", label: "天气图标", sample: "🌧️" },
        { key: "first", label: "体感或最低温度", sample: "体感\n25℃" }, { key: "humidity", label: "湿度", sample: "湿度\n42%" },
        { key: "wind", label: "风速", sample: "风速\n2.3 m/s" }, { key: "range", label: "温度范围", sample: "温度范围  15～26℃" },
        { key: "day", label: "白天", sample: "白天\n小雨" }, { key: "night", label: "夜间", sample: "夜间\n多云" }, { key: "date", label: "日期", sample: "10月15日" },
    ]
}];
export function weatherDesignValues(data: WeatherCardData, copy: WeatherCardCopy): Record<string, string> {
    const result: Record<string, string> = {};

    for (const key of ["city", "area", "condition", "humidity", "wind", "range", "day", "night", "date", "temperature", "first", "day_icon", "night_icon", "icon"] as const) {
        result[key] = weatherCardValue(key, data, copy);
    }

    return result;
}
