import type { OutgoingMessage } from "@qqbot/sdk";
import type { MessageFormat } from "../types.js";
export function message(text: string, format: MessageFormat): OutgoingMessage {
  return format === "markdown" ? { markdown: { content: text } } : { text };
}
