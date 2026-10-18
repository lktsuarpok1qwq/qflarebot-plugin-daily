import type { CopySample } from "../../shared/declarations.js";
import type { WeatherExample } from "./rendering.js";
import { commandLink, commandUrl } from "../../shared/interpolation.js";
export const weatherSamples: (CopySample & { data: WeatherExample })[] = [
    { id: "weather", name: "天气信息", data: { values: { city: "示例城市 · 示例地区", date: "2026-10-03", condition: "晴", temp: "24", feels: "25", humidity: "48", wind: "3", low: "18", high: "27", day: "晴", night: "多云", updated: "10月3日" }, fragments: { current_url: commandUrl("/天气 示例城市") } } },
    { id: "candidates", name: "多个地点", data: { candidates: ["示例地区一", "示例地区二"].map((area) => ({ city: "示例城市", area, command: "/天气 示例城市 " + area, command_link: commandLink("/天气 示例城市 " + area, "/天气 示例城市 " + area), command_url: commandUrl("/天气 示例城市 " + area) })) } },
    ...["help", "notFound", "unavailable"].map((key) => ({ id: key, name: key === "help" ? "无特殊情景" : key === "notFound" ? "未找到地点" : "暂无天气信息", data: {} })),
];
