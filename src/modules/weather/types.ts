import type { CardState } from "../../shared/cards/types.js";
import type { WeatherCardCopy } from "./cards/copy.js";
import type { WEATHER_COPY } from "./copy.js";
export type WeatherConfig = { schemaVersion: 2; cardDesigns?: CardState; host: string; apiKey: string; copy: typeof WEATHER_COPY; imageEnabled?: boolean; cardCopy?: WeatherCardCopy };
export type WeatherState = { revision: number; config: WeatherConfig };
export type City = { id: string; name: string; area: string; lat: string; lon: string; tz: string };
export type Current = {
    code?: string;
    condition: string;
    temp: string;
    feels: string;
    humidity: string;
    wind: string;
};
type Daily = { date: string; code?: string; nightCode?: string; sunrise?: string; sunset?: string; humidity?: string; wind?: string } & Partial<Record<"low" | "high" | "day" | "night", string>>;
export type Forecast = { days: Daily[] };
