export const WEATHER_THEMES = ["sunny", "cloudy", "overcast", "rainy", "heavy-rain", "thunderstorm", "snowy", "sleet", "fog", "haze", "sand", "hot", "cold", "unknown", "clear-night", "cloudy-night"] as const;
export type WeatherTheme = typeof WEATHER_THEMES[number];
const groups: [WeatherTheme, readonly string[]][] = [
    ["sunny", ["100"]], ["cloudy", ["101", "102", "103"]], ["overcast", ["104"]],
    ["rainy", ["300", "305", "306", "309", "314", "399"]],
    ["heavy-rain", ["301", "307", "308", "310", "311", "312", "315", "316", "317", "318"]],
    ["thunderstorm", ["302", "303", "304"]], ["sleet", ["313", "404", "405", "406"]],
    ["snowy", ["400", "401", "402", "403", "407", "408", "409", "410", "499"]],
    ["fog", ["500", "501", "509", "510", "514", "515"]], ["haze", ["502", "511", "512", "513"]],
    ["sand", ["503", "504", "507", "508"]], ["hot", ["900"]], ["cold", ["901"]], ["unknown", ["999"]],
];
const themes = new Map(groups.flatMap(([theme, codes]) => codes.map((code) => [code, theme] as const)));
export function weatherTheme(code: string, night = false): WeatherTheme {
    const theme = themes.get(code) ?? "unknown";
    return night && theme === "sunny" ? "clear-night" : night && theme === "cloudy" ? "cloudy-night" : theme;
}
export const WEATHER_SYMBOLS: Record<WeatherTheme, string> = {
    sunny: "☀️", cloudy: "⛅", overcast: "☁️", rainy: "🌧️", "heavy-rain": "🌧️", thunderstorm: "⛈️",
    snowy: "🌨️", sleet: "🌨️", fog: "🌫️", haze: "🌫️", sand: "🌪️", hot: "🌡️", cold: "❄️",
    unknown: "❔", "clear-night": "🌙", "cloudy-night": "☁️",
};
