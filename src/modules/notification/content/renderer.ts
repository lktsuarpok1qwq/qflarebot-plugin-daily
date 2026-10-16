import type { Rendered } from "../../../shared/types.js";
import type { Config, Task } from "../types.js";
import { expand } from "../../../shared/interpolation.js";
import { validateTemplate } from "../../../shared/templates.js";
import type { VariableAPI } from "../../../shared/variables.js";
export async function renderMessage(
    task: Pick<Task, "templateId">,
    config: Config,
    due: number,
    resolve: ReturnType<VariableAPI["resolve"]>,
    keysAllowed: readonly string[],
): Promise<Rendered> {
    const template = config.templates.find((t) => t.id === task.templateId);

    if (!template) {
        throw new Error("任务引用的文案模板不存在");
    }

    const body = template.body;
    const keys = [...validateTemplate(body, keysAllowed)];
    const values = await resolve(keys, due);
    const text = expand(body, {}, values);
    return { text: text.trim() ? text : "" };
}
