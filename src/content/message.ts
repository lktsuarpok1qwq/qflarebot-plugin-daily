import type { OutgoingMessage } from "@qqbot/sdk";
export function message(text: string): OutgoingMessage {
  return { markdown: { content: text } };
}
