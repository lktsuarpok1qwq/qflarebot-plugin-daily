import type { PluginContext, DBStatement, CommandInput, OutgoingMessage } from "@qqbot/sdk";
export type Ctx = PluginContext;
export type CommandReply = { body: string };
export type CommandFeedback = { error: string; tooLong: string };
export type Rendered = { text: string };
export type CommandExecutor = (
    input: CommandInput,
    name: string,
    render: () => Promise<Rendered>,
) => Promise<OutgoingMessage | void>;
/** Predicates and gated statements compose one atomic restore without exposing module tables. */
export type RestorePart = { guard: DBStatement; statements: (gate: DBStatement) => DBStatement[] };
export const BODY_BYTES = 256_000;
