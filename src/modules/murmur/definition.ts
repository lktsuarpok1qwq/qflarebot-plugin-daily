import { createCopyContract } from "../../shared/copy-contract.js";
import { outputTargets, type CopyDeclaration } from "../../shared/declarations.js";
import { MURMUR_COPY, murmurVariables } from "./copy.js";

export const sample = { text: "今天的晚风很舒服，想和你把这条路慢慢走完" };
const declaration: CopyDeclaration = {
    id: "murmur", title: "絮语文案", initial: "today",
    outputs: outputTargets([{ id: "today", variable: murmurVariables.variables[0]! }]),
    samples: [{ id: "text", name: "无特殊情景", values: sample }],
    fields: {
        today: { label: "公告格式", category: "输出文案", path: ["copy", "today"], default: MURMUR_COPY.today, variables: { text: "当天选用的文案正文，保留 Markdown 和换行" }, samples: ["text"], buttons: false, allowEmpty: true },
    },
    views: [{ id: "today", keys: ["today"], targets: ["today"] }],
};
export const copyContract = createCopyContract<{ copy: typeof MURMUR_COPY }>(declaration);
