import { copyContract } from "./definition.js";
import type { WeatherConfig } from "./types.js";
import { BODY_BYTES } from "../../shared/types.js";
import { fields, str } from "../../shared/validation.js";
export function defaults(): WeatherConfig {
    return copyContract.defaults({ schemaVersion: 2, host: "", apiKey: "" });
}
function validateConnection(c: Pick<WeatherConfig, "host" | "apiKey">) {
    str(c.host, 200, "API Host", true);
    str(c.apiKey, 256, "API Key", true);

    if (c.host && !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+qweatherapi\.com$/.test(c.host)) {
        throw new Error("API Host 请填写和风控制台中的域名，不含 https:// 或路径");
    }

    if (c.apiKey && !/^[A-Za-z0-9_-]+$/.test(c.apiKey)) {
        throw new Error("API Key 格式错误");
    }

}
export function parseConfig(raw: string): WeatherConfig {
    const c = JSON.parse(raw) as WeatherConfig;

    if (c?.schemaVersion !== 2) { throw new Error("天气配置格式错误"); }

    copyContract.validate(c, true);
    validateConnection(c);
    return c;
}
export function validate(value: unknown): WeatherConfig {
    const c = value as WeatherConfig;

    if (!c || typeof c !== "object" || Array.isArray(c) || c.schemaVersion !== 2) {
        throw new Error("天气配置格式错误");
    }

    fields(c, ["schemaVersion", "host", "apiKey", "copy"]);
    validateConnection(c);

    copyContract.validate(c);

    if (new TextEncoder().encode(JSON.stringify(c)).length > BODY_BYTES) {
        throw new Error("天气配置总量超限");
    }

    return c;
}
