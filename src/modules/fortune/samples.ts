import type { CopySample } from "../../shared/declarations.js";
import { LEVELS, RARITIES, type FortuneDocument, type FortuneResult } from "./types.js";
import { LEVEL_NAMES } from "./copy.js";
// Structural placeholders for preview only; never passed to the production draw pool.
export const fortuneSamples: (CopySample & { document: FortuneDocument })[] = (Object.keys(LEVELS) as (keyof typeof LEVELS)[]).map((level, i) => ({
    id: level, name: LEVEL_NAMES[level], document: {
        kind: "draw", result: {
            date: "2026-10-10", score: LEVELS[level][1],
            entry: { id: "preview", level, rarity: RARITIES[i % RARITIES.length]!, theme: "daily", weight: 1, tags: ["general"], title: "标题示例", sign: "签文示例", explanation: "解签示例" },
            good: [1, 2].map((n) => ({ id: "g" + n, kind: "good", text: "宜条目" + n, tags: ["general"], weight: 1 })),
            bad: [1, 2].map((n) => ({ id: "b" + n, kind: "bad", text: "忌条目" + n, tags: ["general"], weight: 1 })),
            effect: { id: "effect", type: i < 3 ? "buff" : "debuff", name: "状态名称", description: "状态说明", tags: ["general"], weight: 1 },
            item: { id: "item", name: "物品名称", description: "物品说明", tags: ["general"], weight: 1 },
            egg: { id: "egg", text: "彩蛋内容", tags: ["general"], weight: 1 },
        }
    }
}));
const base = (fortuneSamples[0]!.document as { kind: "draw"; result: FortuneResult }).result;
const minimal: FortuneResult = { ...base, good: [], bad: [], effect: undefined, item: undefined, egg: undefined };
fortuneSamples.push({ id: "minimal", name: "无可选内容", document: { kind: "draw", result: minimal } });

for (const [kind, name] of [["help", "无特殊情景"], ["noIdentity", "身份不可用"], ["unavailable", "运势不可用"]] as const) {
    fortuneSamples.push({ id: kind, name, document: { kind } });
}
