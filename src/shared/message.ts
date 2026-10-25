import { button, keyboard } from "@qqbot/sdk";
import type { OutgoingMessage } from "@qqbot/sdk";
import type { MessageButtons } from "./message-buttons.js";

export function message(text: string, buttons?: MessageButtons, forceVerifyImage = false): OutgoingMessage {
    return {
        markdown: { content: text, ...(forceVerifyImage ? { forceVerifyImage: true } : {}) },
        ...(buttons?.length ? {
            keyboard: keyboard(buttons.map(row => row.map(item => item.action === "link"
                ? button.link(item.label, item.data, { visitedLabel: item.label })
                : button.command(item.label, item.data, { enter: item.enter, visitedLabel: item.label }))))
        } : {}),
    };
}
