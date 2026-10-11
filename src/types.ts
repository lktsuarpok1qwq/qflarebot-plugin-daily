import type { CommandReply, CommandFeedback } from "./shared/types.js";
export type CommandName = "每日";
export type Config = { schemaVersion: number; replies: Record<CommandName, CommandReply>; commandFeedback: CommandFeedback };
export const CONFIG_KEYS = ["schemaVersion", "replies", "commandFeedback"] as const;
