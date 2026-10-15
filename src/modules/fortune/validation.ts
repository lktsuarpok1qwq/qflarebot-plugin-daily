import type { FortuneCorpusIndex } from "./cards/types.js";
import { validWeights } from "./random.js";
import { LEVELS, RARITIES, THEMES, type DrawSettings } from "./types.js";
export function validateSettings(config: DrawSettings, corpus?: Pick<FortuneCorpusIndex, "cards">) {
    validWeights(Object.keys(LEVELS).map((level) => config[`level_${level as keyof typeof LEVELS}`]));
    validWeights(RARITIES.map((rarity) => config[`rarity_${rarity}`]));

    if (THEMES.some((theme) => typeof config[`theme_${theme}`] !== "boolean") || typeof config.eggs !== "boolean") { throw new Error("主题和彩蛋开关格式错误"); }

    if (!THEMES.some((theme) => config[`theme_${theme}`])) { throw new Error("至少启用一个主题"); }

    if (corpus) { validateThemeCoverage(config, corpus); }
}
export function validateThemeCoverage(config: DrawSettings, corpus: Pick<FortuneCorpusIndex, "cards">) {
    for (const level of Object.keys(LEVELS) as (keyof typeof LEVELS)[]) {
        if (config[`level_${level}`] > 0 && !THEMES.some(theme => config[`theme_${theme}`] && corpus.cards[theme][level][1] > 0)) { throw new Error("启用主题未覆盖等级：" + level); }
    }
}
