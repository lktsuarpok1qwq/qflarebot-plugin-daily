import { BODY_BYTES } from "../../shared/types.js";
import { fields, str } from "../../shared/validation.js";
import { validateTemplate } from "../../shared/templates.js";
import { SAYING_COPY, SAYING_FIELDS } from "./copy.js";
export type SayingConfig = { schemaVersion: 1; copy: typeof SAYING_COPY };
export type SayingState = { revision: number; config: SayingConfig };
export function defaults(): SayingConfig {
    return { schemaVersion: 1, copy: { ...SAYING_COPY } };
}
export function parseConfig(raw: string): SayingConfig {
    const c = JSON.parse(raw) as SayingConfig;

    if (c?.schemaVersion !== 1 || !c.copy || Array.isArray(c.copy) || Object.keys(SAYING_COPY).some((key) => typeof c.copy[key as keyof typeof SAYING_COPY] !== "string")) {
        throw new Error("一言配置格式错误");
    }

    return c;
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

    for (const key of Object.keys(SAYING_COPY) as (keyof typeof SAYING_COPY)[]) {
        str(config.copy[key], Infinity, "一言文案");
        validateTemplate(config.copy[key], Object.keys(SAYING_FIELDS));
    }

    if (new TextEncoder().encode(JSON.stringify(config)).length > BODY_BYTES) {
        throw new Error("一言配置总量超限");
    }

    return config;
}
