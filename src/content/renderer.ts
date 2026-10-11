import type { Config, Rendered, Source, Task } from "../types.js";
import { dateAt } from "../scheduler/planner.js";
import { validateTemplate } from "./templates.js";
import { createRenderContext } from "../modules/index.js";
export async function renderMessage(
    task: Task,
    config: Config,
    due: number,
    sources: Source[] = [],
    resolve = createRenderContext(config, sources, due),
): Promise<Rendered> {
    const body = task.body;
    validateTemplate(body);
    const keys = [...body.matchAll(/\{\{([^{}]+)\}\}/g)].map((m) => m[1]!);
    const day = dateAt(due),
        weekday = `星期${"日一二三四五六"[new Date(day).getUTCDay()]}`;
    const values: Record<string, string> = {
        ...(await resolve(keys)),
        日期: day,
        星期: weekday,
    };
    // A single substitution preserves Markdown and line breaks authored in the template.
    const text = body.replace(/\{\{([^{}]+)\}\}/g, (_, key: string) => values[key] ?? "");
    return { text: text.trim() ? text : "" };
}
