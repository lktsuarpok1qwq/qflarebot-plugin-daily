import { deliverReply } from "@qqbot/sdk";
import type { CommandExecutor, CommandFeedback, Ctx, Rendered } from "../shared/types.js";
import { readConfig } from "../data/repository.js";
import { COPY } from "../copy.js";
import { dateAt } from "../shared/date.js";
import { expand } from "../shared/interpolation.js";
import { message } from "../shared/message.js";
function feedbackText(copy: CommandFeedback, key: keyof CommandFeedback, now = Date.now()) {
    const day = dateAt(now);
    return expand(copy[key], { today: day, year: day.slice(0, 4) });
}
async function feedback(ctx: Ctx, key: keyof CommandFeedback) {
    let copy = COPY.commandFeedback;

    try {
        copy = (await readConfig(ctx.db)).commandFeedback;
    } catch {
        // Database failures still need a usable command response.
    }

    return message(feedbackText(copy, key));
}
export const executeCommand: CommandExecutor = async (input, name, render) => {
    let result: Rendered;

    try {
        result = await render();

        if (!result.reply && !result.text.trim()) {
            if (result.empty === "skip") { return; }

            throw new Error("命令文案为空");
        }
    } catch (error) {
        input.ctx.logger.warn("命令处理失败", { command: name, stage: "command_render", error: String(error) });
        return feedback(input.ctx, "error");
    }

    try {
        const [sent] = await deliverReply(input.session, result.reply ?? message(result.text));

        if (sent && !sent.ok) {
            input.ctx.logger.warn("命令回复失败", { ...result.diagnostics, command: name, stage: "send", status: sent.status, code: sent.code, traceId: sent.traceId, error: sent.error });

            if (sent.code === 40054007) {
                return feedback(input.ctx, "tooLong");
            }
        }

        if (sent?.ok && result.afterSend) {
            try { await result.afterSend(); } catch (error) {
                input.ctx.logger.warn("命令发送后记录失败", { ...result.diagnostics, command: name, stage: "after_send", error: String(error) });
            }
        }
    } catch (error) {
        input.ctx.logger.warn("命令回复状态不确定", { ...result.diagnostics, command: name, stage: "send_unknown", error: String(error) });
    }
};
