import type { Rendered } from "../shared/types.js";
import type { Config, Task } from "../types.js";
import { dateAt } from "../shared/date.js";
import { validateTemplate } from "./templates.js";
import { createRenderContext } from "../modules/index.js";
export async function renderMessage(
    task: Pick<Task, "templateId">,
    config: Config,
    due: number,
    resolve: ReturnType<typeof createRenderContext>,
): Promise<Rendered> {
    const template = config.templates.find((t) => t.id === task.templateId);

    if (!template) {
        throw new Error("任务引用的文案模板不存在");
    }

    const body = template.body;
    validateTemplate(body);
    const keys = [...body.matchAll(/\{\{([^{}]+)\}\}/g)].map((m) => m[1]!);
    const day = dateAt(due),
        weekday = `星期${"日一二三四五六"[new Date(day).getUTCDay()]}`;
    const values: Record<string, string> = {
        ...(await resolve(keys, due)),
        日期: day,
        星期: weekday,
    };
    // A single substitution preserves Markdown and line breaks authored in the template.
    const text = body.replace(/\{\{([^{}]+)\}\}/g, (_, key: string) => values[key] ?? "");
    return { text: text.trim() ? text : "" };
}
