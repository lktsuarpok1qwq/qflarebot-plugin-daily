import { declareVariables } from "../../shared/variables.js";

export const MURMUR_COPY = { today: "💬 今日絮语\n\n{{text}}" };
export const murmurVariables = declareVariables({
    "絮语.今日": { description: "每日一篇，新文案优先，用完按顺序循环，文案库为空时不输出", group: "完整文案" },
});
