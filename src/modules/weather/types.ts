import type { WEATHER_COPY } from "./copy.js";
export type WeatherConfig = { schemaVersion: 2; host: string; apiKey: string; copy: typeof WEATHER_COPY };
export type WeatherState = { revision: number; config: WeatherConfig };
export type City = { id: string; name: string; area: string; lat: string; lon: string; tz: string };
export type Current = {
    condition: string;
    temp: string;
    feels: string;
    humidity: string;
    wind: string;
};
export type Daily = { date: string; low: string; high: string; day: string; night: string };
export type Forecast = { days: Daily[] };
