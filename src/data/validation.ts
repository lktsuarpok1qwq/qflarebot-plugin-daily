import { fields } from "../shared/validation.js";
const SCHEMA_VERSION = 1;
import { BODY_BYTES } from "../shared/types.js";
import { type Config } from "../types.js";
import { copyContract } from "../content/definition.js";
export function validateConfig(value: unknown): Config {
    if (!value || typeof value !== "object" || Array.isArray(value)) { throw new Error("配置必须为对象"); }

    const c = value as Config;
    fields(c, ["schemaVersion", "replies", "commandFeedback"]);

    if (c.schemaVersion !== SCHEMA_VERSION) { throw new Error("不支持的 schemaVersion"); }

    copyContract.validate(c);

    if (new TextEncoder().encode(JSON.stringify(c)).length > BODY_BYTES) { throw new Error("配置总量超限"); }

    return c;
}
