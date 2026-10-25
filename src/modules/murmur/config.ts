import { BODY_BYTES } from "../../shared/types.js";
import { fields, str } from "../../shared/validation.js";
import { copyContract } from "./definition.js";
import { MURMUR_COPY } from "./copy.js";

export const MAX_BATCH = 100;

export type MurmurConfig = { schemaVersion: 1; copy: typeof MURMUR_COPY };

export function defaults(): MurmurConfig {
    return copyContract.defaults({ schemaVersion: 1 as const });
}

export function validateText(value: unknown): asserts value is string {
    str(value, Infinity, "絮语正文");

    if (new TextEncoder().encode(value).length > BODY_BYTES) { throw new Error("絮语正文超过请求大小限制"); }
}

export function validate(value: unknown): MurmurConfig {
    const config = value as MurmurConfig;

    if (!config || typeof config !== "object" || Array.isArray(config) || config.schemaVersion !== 1) {
        throw new Error("絮语配置格式错误");
    }

    fields(config, ["schemaVersion", "copy"]);
    copyContract.validate(config);

    return config;
}

export function parseConfig(raw: string): MurmurConfig {
    return validate(JSON.parse(raw));
}
