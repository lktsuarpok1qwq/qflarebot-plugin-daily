import type { ButtonConfiguration } from "../../shared/message-buttons.js";
import { BODY_BYTES } from "../../shared/types.js";
import { fields } from "../../shared/validation.js";
import { copyContract } from "./definition.js";
import { SAYING_COPY } from "./copy.js";

export type SayingConfig = ButtonConfiguration & { schemaVersion: 1; copy: typeof SAYING_COPY };

export function defaults(): SayingConfig {
    return copyContract.defaults({ schemaVersion: 1 });
}

export function parseConfig(raw: string): SayingConfig {
    const c = JSON.parse(raw) as SayingConfig;

    if (c?.schemaVersion !== 1) { throw new Error("一言配置格式错误"); }

    copyContract.validate(c, true);

    return c;
}

export function validate(value: unknown): SayingConfig {
    const config = value as SayingConfig;

    if (!config || typeof config !== "object" || Array.isArray(config) || config.schemaVersion !== 1) {
        throw new Error("一言配置格式错误");
    }

    fields(config, ["schemaVersion", "buttons", "copy"]);

    copyContract.validate(config);

    if (new TextEncoder().encode(JSON.stringify(config)).length > BODY_BYTES) {
        throw new Error("一言配置总量超限");
    }

    return config;
}
