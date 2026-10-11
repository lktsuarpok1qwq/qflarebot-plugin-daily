import { fields, str } from "../shared/validation.js";
import { validateTemplate } from "../shared/templates.js";
import { SCHEMA_VERSION } from "../shared/state.js";
import { BODY_BYTES } from "../shared/types.js";
import { CONFIG_KEYS, type Config } from "../types.js";
import { copyEditor } from "../content/definition.js";
import { COPY } from "../copy.js";
import type { CommandName } from "../types.js";
const COMMAND_NAMES = Object.keys(COPY.replies) as CommandName[];
export function validateConfig(value: unknown): Config {
    if (!value || typeof value !== "object" || Array.isArray(value)) { throw new Error("配置必须为对象"); }

    const c = value as Config;
    fields(c, CONFIG_KEYS);

    if (c.schemaVersion !== SCHEMA_VERSION) { throw new Error("不支持的 schemaVersion"); }

    if (!c.replies || typeof c.replies !== "object" || Array.isArray(c.replies)) {
        throw new Error("缺少命令回复配置");
    }

    fields(c.replies, COMMAND_NAMES);

    for (const name of COMMAND_NAMES) {
        const reply = c.replies[name];

        if (!reply || typeof reply !== "object") {
            throw new Error("命令回复格式错误");
        }

        fields(reply, ["body"]);
        str(reply.body, Infinity, "命令回复");
        validateTemplate(reply.body, Object.keys(copyEditor.fields["command:" + name]!.variables));
    }

    if (!c.commandFeedback || typeof c.commandFeedback !== "object" || Array.isArray(c.commandFeedback)) {
        throw new Error("缺少通用提示配置");
    }

    fields(c.commandFeedback, ["error", "tooLong"]);

    for (const key of ["error", "tooLong"] as const) {
        const value = c.commandFeedback[key];
        str(value, Infinity, "通用提示");
        validateTemplate(value, ["year", "today"]);
    }

    if (new TextEncoder().encode(JSON.stringify(c)).length > BODY_BYTES) { throw new Error("配置总量超限"); }

    return c;
}
