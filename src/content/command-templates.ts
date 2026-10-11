import type { CommandName, Config } from "../types.js";
import { COPY } from "../copy.js";
export const COMMAND_DEFAULTS = COPY.replies;
export const COMMAND_NAMES = Object.keys(COMMAND_DEFAULTS) as CommandName[];
export function defaultReplies(): Config["replies"] {
    return structuredClone(COMMAND_DEFAULTS);
}
export function replyVariables(_name: CommandName): Record<string, readonly string[]> {
    return { body: ["year", "today"] };
}
