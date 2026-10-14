import characters from "./generated/characters.json";
import type { FortuneCopy } from "../copy.js";
import { LEVELS, RARITIES } from "../types.js";
import type { FortuneCardLabels } from "./types.js";
export function cardLabels(copy: FortuneCopy): FortuneCardLabels {
    return {
        levels: Object.fromEntries(Object.keys(LEVELS).map(level => [level, copy[`level_${level as keyof typeof LEVELS}`]])) as FortuneCardLabels["levels"],
        rarities: Object.fromEntries(RARITIES.map(rarity => [rarity, copy[`rarity_${rarity}`]])) as FortuneCardLabels["rarities"]
    };
}
export function validateCardLabels(copy: FortuneCopy) {
    const labels = cardLabels(copy);

    for (const [values, size, weight, limit, name] of [[labels.levels, 40, 700, 2, "吉凶名称"], [labels.rarities, 24, 400, 6, "稀有度名称"]] as const) {
        const available = new Set(characters[`${weight}-${size}` as keyof typeof characters] ?? "");

        for (const text of Object.values(values)) {
            if (!text.trim() || [...text].length > limit || /[\r\n\t]/.test(text)) { throw new Error(`${name}需要 1–${limit} 个字，不能换行`); }

            if ([...text].some(character => !available.has(character))) { throw new Error(`${name}包含未生成的卡面字形`); }
        }
    }
}
