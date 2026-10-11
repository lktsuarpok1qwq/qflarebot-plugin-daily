import { WEATHER_COPY, WEATHER_FIELDS } from "./copy.js";
import type { WeatherConfig } from "./types.js";
import { BODY_BYTES } from "../../shared/types.js";
import { fields, str } from "../../shared/validation.js";
import { validateTemplate } from "../../shared/templates.js";
export function defaults(): WeatherConfig {
    return { schemaVersion: 1, host: "", apiKey: "", copy: structuredClone(WEATHER_COPY) };
}
export function validate(value: unknown): WeatherConfig {
    const c = value as WeatherConfig;

    if (!c || typeof c !== "object" || Array.isArray(c) || c.schemaVersion !== 1) {
        throw new Error("天气配置格式错误");
    }

    fields(c, ["schemaVersion", "host", "apiKey", "copy"]);
    str(c.host, 200, "API Host", true);
    str(c.apiKey, 256, "API Key", true);

    if (c.host && !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+qweatherapi\.com$/.test(c.host)) {
        throw new Error("API Host 请填写和风控制台中的域名，不含 https:// 或路径");
    }

    if (c.apiKey && !/^[A-Za-z0-9_-]+$/.test(c.apiKey)) {
        throw new Error("API Key 格式错误");
    }

    if (!c.copy || typeof c.copy !== "object" || Array.isArray(c.copy)) {
        throw new Error("天气文案格式错误");
    }

    fields(c.copy, Object.keys(WEATHER_COPY));

    for (const key of Object.keys(WEATHER_COPY) as (keyof typeof WEATHER_COPY)[]) {
        str(c.copy[key], Infinity, "天气文案");
        validateTemplate(c.copy[key], Object.keys(WEATHER_FIELDS[key].variables));
    }

    if (new TextEncoder().encode(JSON.stringify(c)).length > BODY_BYTES) {
        throw new Error("天气配置总量超限");
    }

    return c;
}
