import type { CardState } from "../../shared/cards/types.js";
import { validateCardState } from "../../shared/cards/validation.js";
import { fortuneDesigns } from "./cards/design.js";
import { BODY_BYTES } from "../../shared/types.js";
import { fields } from "../../shared/validation.js";
import { copyContract } from "./definition.js";
import { corpus } from "./corpus.js";
import { validateCardLabels } from "./cards/labels.js";
import { validateSettings } from "./validation.js";
import { LEVELS, RARITIES, THEMES, type DrawSettings } from "./types.js";
import type { FortuneCopy } from "./copy.js";
export type FortuneConfig = { schemaVersion: 1; cardDesigns?: CardState; imageEnabled: boolean; copy: FortuneCopy } & DrawSettings;
const configFields = ["schemaVersion", "cardDesigns", "imageEnabled", "copy", "eggs", ...Object.keys(LEVELS).map((key) => "level_" + key), ...RARITIES.map((key) => "rarity_" + key), ...THEMES.map((key) => "theme_" + key)];
export function defaults(): FortuneConfig {
    return copyContract.defaults({ schemaVersion: 1, imageEnabled: true, level_great: 10, level_good: 20, level_small: 30, level_neutral: 20, level_bad: 15, level_worst: 5, rarity_common: 75, rarity_rare: 20, rarity_epic: 4, rarity_legendary: 1, theme_absurd: true, theme_gaming: true, theme_daily: true, theme_student: true, theme_mystic: true, eggs: true });
}
export function validate(value: unknown, shapeOnly = false): FortuneConfig {
    const config = value as FortuneConfig;

    if (!config || typeof config !== "object" || Array.isArray(config) || config.schemaVersion !== 1) { throw new Error("运势配置格式错误"); }

    fields(config, configFields);

    if (typeof config.imageEnabled !== "boolean") { throw new Error("图片卡片开关格式错误"); }

    if (config.cardDesigns !== undefined) { config.cardDesigns = validateCardState(config.cardDesigns, fortuneDesigns, "fortune"); }

    validateSettings(config, shapeOnly ? undefined : corpus);
    copyContract.validate(config, shapeOnly);

    if (!shapeOnly) { validateCardLabels(config.copy); }

    if (!shapeOnly && new TextEncoder().encode(JSON.stringify(config)).length > BODY_BYTES) { throw new Error("运势配置总量超限"); }

    return config;
}
export function parseConfig(raw: string): FortuneConfig {
    return validate(JSON.parse(raw), true);
}
