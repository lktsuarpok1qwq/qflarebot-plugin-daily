import type { ButtonConfiguration } from "./shared/message-buttons.js";
import type { CommandReply, CommandFeedback } from "./shared/types.js";

export type CommandName = "每日";
export type Config = ButtonConfiguration & { schemaVersion: number; imagePublicUrl?: string; replies: Record<CommandName, CommandReply>; commandFeedback: CommandFeedback };
