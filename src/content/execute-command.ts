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

        if (!result.text.trim()) {
            if (result.empty === "skip") { return; }

            throw new Error("命令文案为空");
        }
    } catch (error) {
        input.ctx.logger.warn("命令处理失败", { command: name, error: String(error) });
        return feedback(input.ctx, "error");
    }

    try {
        const [sent] = await deliverReply(input.session, message(result.text));

        if (sent && !sent.ok) {
            input.ctx.logger.warn("命令回复失败", { command: name, code: sent.code, error: sent.error });

            if (sent.code === 40054007) {
                return feedback(input.ctx, "tooLong");
            }
        }
    } catch (error) {
        input.ctx.logger.warn("命令回复状态不确定", { command: name, error: String(error) });
    }
};
