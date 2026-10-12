import { createCopyContract } from "../../shared/copy-contract.js";
import { outputTargets, type CopyDeclaration } from "../../shared/declarations.js";
import { SAYING_COPY, SAYING_FIELDS, sayingVariables } from "./copy.js";
export const sayingSample = { id: "saying", name: "无特殊情景", values: { text: "愿你今天也有值得期待的小事" } };
export const commands = [{ name: "一言", description: "随机一句话" }];
const outputs = outputTargets([
    { id: "today", variable: sayingVariables.variables[0]! },
    { id: "command", command: commands[0]!.name },
]);
const declaration: CopyDeclaration = {
    id: "saying", title: "一言文案", initial: "body", outputs,
    samples: [sayingSample],
    description: "命令每次随机查询，今日变量当天固定，文案分别设置",
    fields: {
        today: { label: "今日一言", category: "输出文案", samples: ["saying"], variables: SAYING_FIELDS, path: ["copy", "today"], inputId: "sayingToday", default: SAYING_COPY.today },
        body: { label: "随机一言", category: "输出文案", samples: ["saying"], variables: SAYING_FIELDS, path: ["copy", "body"], inputId: "sayingBody", default: SAYING_COPY.body },
    },
    views: [{ id: "body", keys: ["body"], targets: ["command"] }, { id: "today", keys: ["today"], targets: ["today"] }],
};

export const copyContract = createCopyContract<{ copy: typeof SAYING_COPY }>(declaration);
export const copyEditor = copyContract.editor;
