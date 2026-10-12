import type { CommandReply, CommandFeedback } from "./shared/types.js";
export type CommandName = "每日";
export type Config = { schemaVersion: number; replies: Record<CommandName, CommandReply>; commandFeedback: CommandFeedback };
