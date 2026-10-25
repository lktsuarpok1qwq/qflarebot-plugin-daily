import { validateCardState } from "../../shared/cards/validation.js";
import { weatherDesigns } from "./cards/design.js";
import { WEATHER_CARD_COPY } from "./cards/copy.js";
import { copyContract, connectionFields } from "./definition.js";
import type { WeatherConfig } from "./types.js";
import { BODY_BYTES } from "../../shared/types.js";
import { fields, str } from "../../shared/validation.js";

const connectionPatterns = connectionFields.map(field => new RegExp('^(?:' + field.pattern + ')$'));

export function defaults(): WeatherConfig {
    return copyContract.defaults({ schemaVersion: 2, host: "", apiKey: "", imageEnabled: true, cardCopy: { ...WEATHER_CARD_COPY } });
}

function validateConnection(c: Pick<WeatherConfig, "host" | "apiKey">) {
    str(c.host, connectionFields[0].maxLength, "API Host", true);
    str(c.apiKey, connectionFields[1].maxLength, "API Key", true);

    if (c.host && !connectionPatterns[0]!.test(c.host)) {
        throw new Error("API Host 请填写和风控制台中的域名，不含 https:// 或路径");
    }

    if (c.apiKey && !connectionPatterns[1]!.test(c.apiKey)) {
        throw new Error("API Key 格式错误");
    }
}

export function parseConfig(raw: string): WeatherConfig {
    const c = JSON.parse(raw) as WeatherConfig;

    if (c?.schemaVersion !== 2) { throw new Error("天气配置格式错误"); }

    copyContract.validate(c, true);

    if (typeof c.imageEnabled !== "boolean") { throw new Error("图片开关格式错误"); }

    validateConnection(c);

    return c;
}

export function validate(value: unknown): WeatherConfig {
    const c = value as WeatherConfig;

    if (!c || typeof c !== "object" || Array.isArray(c) || c.schemaVersion !== 2) {
        throw new Error("天气配置格式错误");
    }

    fields(c, ["schemaVersion", "buttons", "cardDesigns", "host", "apiKey", "copy", "imageEnabled", "cardCopy"]);
    validateConnection(c);

    if (typeof c.imageEnabled !== "boolean") { throw new Error("图片开关格式错误"); }

    if (c.cardDesigns !== undefined) { c.cardDesigns = validateCardState(c.cardDesigns, weatherDesigns, "weather"); }

    copyContract.validate(c);

    if (new TextEncoder().encode(JSON.stringify(c)).length > BODY_BYTES) {
        throw new Error("天气配置总量超限");
    }

    return c;
}
