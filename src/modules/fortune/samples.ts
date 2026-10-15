import type { CopySample } from "../../shared/declarations.js";
import { corpus } from "./corpus.js";
import type { CardSnapshot } from "./cards/store.js";
import { LEVEL_NAMES, RARITY_NAMES, type FortuneCopy } from "./copy.js";
const textSnapshot = (): CardSnapshot => ({
    content: { ...corpus.sampleCard, date: "2026-10-13", score: 92, rarity: "epic" },
    labels: { levels: LEVEL_NAMES, rarities: RARITY_NAMES },
});
export const fortuneSamples: (CopySample & { field: keyof FortuneCopy; snapshot?: CardSnapshot })[] = [
    { id: "drawText", field: "drawText", name: "文字抽签", get snapshot() { return textSnapshot(); } },
    { id: "detailText", field: "detailText", name: "文字解签 · 无彩蛋", get snapshot() { return textSnapshot(); } },
    { id: "detailTextEgg", field: "detailText", name: "文字解签 · 有彩蛋", get snapshot() { const snapshot = textSnapshot(); return { ...snapshot, content: { ...snapshot.content, egg: corpus.sampleEgg } }; } },
    ...Object.entries(LEVEL_NAMES).map(([id, name]) => ({ id: "level_" + id, name, field: "level_" + id as keyof FortuneCopy })),
    ...Object.entries(RARITY_NAMES).map(([id, name]) => ({ id: "rarity_" + id, name, field: "rarity_" + id as keyof FortuneCopy })),
    ...(["help", "noIdentity", "unavailable", "drawCaption", "detailCaption", "needDraw"] as const).map(field => ({
        id: field, field, name: ({ help: "无特殊情景", noIdentity: "身份不可用", unavailable: "运势不可用", drawCaption: "抽签成功", detailCaption: "解签成功", needDraw: "今天未抽签" })[field]
    }))
];
