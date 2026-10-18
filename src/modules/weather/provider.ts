import { readJson } from "../../shared/json.js";
import type { City, Current, Forecast, WeatherConfig } from "./types.js";
export class NoWeatherData extends Error { }
function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("和风天气数据格式错误");
    }

    return value as Record<string, unknown>;
}
function text(value: unknown): string {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error("和风天气字段缺失");
    }

    return value;
}
function number(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error("和风天气数值错误");
    }

    return value;
}
function percent(value: unknown) {
    const humidity = number(value);

    if (humidity < 0 || humidity > 1) { throw new Error("和风天气湿度错误"); }

    return String(Math.round(humidity * 100));
}
function measurement(value: unknown, unit: string) {
    const v = object(value);

    if (v.unit !== unit) {
        throw new Error("和风天气单位错误");
    }

    return String(Math.round(number(v.value) * 10) / 10);
}
export async function request(config: WeatherConfig, path: string, fetcher: typeof fetch): Promise<unknown> {
    let response: Response;

    try {
        response = await fetcher("https://" + config.host + path, {
            headers: { "X-QW-Api-Key": config.apiKey },
            signal: AbortSignal.timeout(8_000),
            redirect: "manual",
        });
    } catch (error) {
        if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) {
            throw new Error("和风天气请求超时，请稍后重试");
        }

        throw new Error("和风天气连接失败，请检查运行环境的网络");
    }

    if (response.status === 204 || !response.ok) {
        await response.body?.cancel().catch(() => { });

        if (response.status === 204 || response.status === 404) {
            throw new NoWeatherData();
        }

        throw new Error("和风天气 HTTP " + response.status);
    }

    try {
        return await readJson(response);
    } catch {
        throw new Error("和风天气响应无效或读取超时");
    }
}

export async function lookup(config: WeatherConfig, query: string, fetcher: typeof fetch): Promise<City[]> {
    let raw: unknown;

    try {
        raw = await request(
            config,
            "/geo/v2/city/lookup?" + new URLSearchParams({ location: query, number: "5", lang: "zh" }),
            fetcher,
        );
    } catch (error) {
        if (error instanceof NoWeatherData) {
            return [];
        }

        throw error;
    }

    const data = object(raw);

    if (data.code === "404") {
        return [];
    }

    if (data.code !== "200" || !Array.isArray(data.location) || !data.location.length) {
        throw new Error("和风天气城市查询失败");
    }

    return data.location.map((value) => {
        const city = object(value),
            id = text(city.id),
            offset = /^([+-])([01]\d|2[0-3]):([0-5]\d)$/.exec(text(city.utcOffset));
        const latitude = text(city.lat),
            longitude = text(city.lon);
        const lat = Number(latitude),
            lon = Number(longitude);

        if (
            !offset || !/^[\w-]+$/.test(id) ||
            !Number.isFinite(lat) ||
            !Number.isFinite(lon) ||
            Math.abs(lat) > 90 ||
            Math.abs(lon) > 180
        ) {
            throw new Error("和风天气地点数据错误");
        }

        return {
            id,
            name: text(city.name),
            area: [
                ...new Set(
                    [text(city.country), city.adm1, city.adm2].filter(
                        (value): value is string => typeof value === "string" && !!value.trim(),
                    ),
                ),
            ].join(" · "),
            lat: lat.toFixed(2),
            lon: lon.toFixed(2),
            utcOffset: (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === "-" ? -1 : 1),
        };
    });
}
export const CURRENT_FIELDS = ["condition", "temp", "feels", "humidity", "wind"] as const;
export const FORECAST_FIELDS = ["low", "high", "day", "night"] as const;
export function parseCurrent(raw: unknown, fields: readonly (keyof Current)[] = CURRENT_FIELDS): Partial<Current> {
    const data = object(raw);
    const readers = {
        condition: () => text(object(data.condition).text),
        code: () => typeof object(data.condition).code === "string" ? String(object(data.condition).code) : "999",
        temp: () => measurement(data.temperature, "°C"),
        feels: () => measurement(data.feelsLike, "°C"),
        humidity: () => percent(data.humidity),
        wind: () => measurement(object(data.wind).speed, "m/s"),
    };
    return Object.fromEntries(fields.map((key) => [key, readers[key]()]));
}
export function parseForecast(raw: unknown, fields: readonly Exclude<keyof Forecast["days"][number], "date">[] = FORECAST_FIELDS): Forecast {
    const data = object(raw);

    if (!Array.isArray(data.days)) { throw new Error("和风天气预报格式错误"); }

    const days = data.days.map((value) => {
        const day = object(value), start = text(day.forecastStartTime);

        if (!/^\d{4}-\d{2}-\d{2}T/.test(start) || !Number.isFinite(Date.parse(start))) {
            throw new Error("和风天气日期错误");
        }

        const daytime = () => object(day.daytime), nighttime = () => object(day.nighttime);
        const astro = () => day.astro && typeof day.astro === "object" ? day.astro as Record<string, unknown> : {};
        const readers = {
            low: () => measurement(day.temperatureMin, "°C"),
            high: () => measurement(day.temperatureMax, "°C"),
            day: () => text(object(daytime().condition).text),
            night: () => text(object(nighttime().condition).text),
            code: () => String(object(daytime().condition).code ?? "999"),
            nightCode: () => String(object(nighttime().condition).code ?? "999"),
            sunrise: () => typeof astro().sunrise === "string" ? astro().sunrise : undefined,
            sunset: () => typeof astro().sunset === "string" ? astro().sunset : undefined,
        };
        return { date: start.slice(0, 10), ...Object.fromEntries(fields.map(key => [key, readers[key]()])) };
    });
    return { days };
}
