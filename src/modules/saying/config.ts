import { BODY_BYTES } from "../../shared/types.js";
import { fields, str } from "../../shared/validation.js";
import { validateTemplate } from "../../shared/templates.js";
import { SAYING_COPY, SAYING_FIELDS } from "./copy.js";
export type SayingConfig = { schemaVersion: 1; copy: typeof SAYING_COPY };
export type SayingState = { revision: number; config: SayingConfig };
export function defaults(): SayingConfig {
    return { schemaVersion: 1, copy: { ...SAYING_COPY } };
}
export function validate(value: unknown): SayingConfig {
    const config = value as SayingConfig;

    if (!config || typeof config !== "object" || Array.isArray(config) || config.schemaVersion !== 1) {
        throw new Error("一言配置格式错误");
    }

    fields(config, ["schemaVersion", "copy"]);

    if (!config.copy || typeof config.copy !== "object" || Array.isArray(config.copy)) {
        throw new Error("一言文案格式错误");
    }

    fields(config.copy, Object.keys(SAYING_COPY));
    str(config.copy.body, Infinity, "一言文案");
    validateTemplate(config.copy.body, Object.keys(SAYING_FIELDS));

    if (new TextEncoder().encode(JSON.stringify(config)).length > BODY_BYTES) {
        throw new Error("一言配置总量超限");
    }

    return config;
}
