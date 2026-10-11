import type { PluginContext, CommandInput, OutgoingMessage } from "@qqbot/sdk";
export type Ctx = PluginContext;
export type CommandReply = { body: string };
export type CommandFeedback = { error: string; tooLong: string };
export type Rendered = { text: string; empty?: "skip" };
export type CommandExecutor = (
    input: CommandInput,
    name: string,
    render: () => Promise<Rendered>,
) => Promise<OutgoingMessage | void>;
export const BODY_BYTES = 256_000;
