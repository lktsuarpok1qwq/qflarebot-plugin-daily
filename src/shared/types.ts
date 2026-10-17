import type { PluginContext, CommandInput, OutgoingMessage } from "@qqbot/sdk";
import type { Diagnostics } from "./diagnostics.js";
export type Ctx = PluginContext;
export type CommandReply = { body: string };
export type CommandFeedback = { error: string; tooLong: string };
export type Rendered = { text: string; empty?: "skip"; image?: { url: string; fallback: () => string }; diagnostics?: Diagnostics; afterSend?: () => Promise<void> };
export type CommandExecutor = (
    input: CommandInput,
    name: string,
    render: () => Promise<Rendered>,
) => Promise<OutgoingMessage | void>;
export const BODY_BYTES = 256_000;
