import { commandLink } from "../../../shared/interpolation.js";
export const WEATHER_CARD_COPY = {
    city: "{{city}}", area: "{{area}}", current: "{{temp}}℃", condition: "{{condition}}",
    feels: "体感\n{{feels}}℃", humidity: "湿度\n{{humidity}}%", wind: "风速\n{{wind}} m/s",
    range: "温度范围  {{low}}～{{high}}℃", day: "白天\n{{day}}", night: "夜间\n{{night}}", date: "{{date}}",
    caption: "[🌤️ 查看当前]({{current_url}}) · " + commandLink("✏️ 换个城市", "/天气 ", false),
};
export type WeatherCardCopy = typeof WEATHER_CARD_COPY;
export const CARD_VARIABLES = {
    city: "城市名称", area: "所属地区", temp: "当前温度，℃", condition: "当前天气", low: "最低温度，℃", high: "最高温度，℃",
    feels: "体感温度，℃", humidity: "湿度百分比", wind: "风速，米每秒",
    day: "白天天气", night: "夜间天气", date: "当地日期，月日", current_url: "当前天气命令链接",
};
export type WeatherCardData = { values: Record<string, string>; code: string; dayCode: string; nightCode: string; night: boolean; fragments: Record<string, string> };
