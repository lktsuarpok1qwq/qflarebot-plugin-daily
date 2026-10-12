import { fields, str } from "../../shared/validation.js";
import { validDate } from "../../shared/date.js";
import { validWeights } from "./random.js";
import { LEVELS, RARITIES, THEMES, type FortuneCorpus, type DrawSettings } from "./types.js";
export function validateCorpus(value: unknown): FortuneCorpus {
    if (!value || typeof value !== "object" || Array.isArray(value)) { throw new Error("语料格式错误"); }

    const corpus = value as FortuneCorpus;
    fields(corpus, ["fortunes", "actions", "effects", "items", "eggs", "eggChance"]);

    if (typeof corpus.eggChance !== "number" || !Number.isFinite(corpus.eggChance) || corpus.eggChance < 0 || corpus.eggChance > 1) { throw new Error("彩蛋触发率须为 0 至 1"); }

    for (const pool of ["fortunes", "actions", "effects", "items", "eggs"] as const) {
        const entries = corpus[pool];

        if (!Array.isArray(entries)) { throw new Error(pool + "须为数组"); }

        const ids = new Set<string>();
        const keys = { fortunes: ["level", "rarity", "theme", "title", "sign", "explanation"], actions: ["kind", "text"], effects: ["type", "name", "description"], items: ["name", "description"], eggs: ["text", "dates", "weekdays"] }[pool];

        for (const raw of entries) {
            if (!raw || typeof raw !== "object" || Array.isArray(raw)) { throw new Error(pool + "条目格式错误"); }

            const entry = raw as unknown as Record<string, unknown>;
            fields(entry, ["id", "weight", "tags", ...keys]);
            str(entry.id, Infinity, pool + " ID");

            if (ids.has(entry.id)) { throw new Error(pool + "存在重复 ID"); }

            ids.add(entry.id);

            if (typeof entry.weight !== "number" || !Number.isFinite(entry.weight) || entry.weight < 0) { throw new Error(pool + "权重无效"); }

            if (!Array.isArray(entry.tags) || !entry.tags.length) { throw new Error(pool + "须声明标签或 general"); }

            for (const tag of entry.tags) { str(tag, Infinity, "标签"); }

            for (const key of keys.filter((key) => !["dates", "weekdays"].includes(key))) { str(entry[key], Infinity, pool + " " + key, key === "description"); }

            if (pool === "fortunes" && (!Object.hasOwn(LEVELS, String(entry.level)) || !RARITIES.some((rarity) => rarity === entry.rarity) || !THEMES.some((theme) => theme === entry.theme))) { throw new Error("主签分类无效"); }

            if (pool === "actions" && !["good", "bad"].includes(String(entry.kind))) { throw new Error("宜忌类别无效"); }

            if (pool === "effects" && !["buff", "debuff"].includes(String(entry.type))) { throw new Error("状态类别无效"); }

            if (entry.dates !== undefined && (!Array.isArray(entry.dates) || !entry.dates.length || entry.dates.some((date) => typeof date !== "string" || !/^\d{2}-\d{2}$/.test(date) || !validDate("2000-" + date)))) { throw new Error("彩蛋日期无效"); }

            if (entry.weekdays !== undefined && (!Array.isArray(entry.weekdays) || !entry.weekdays.length || entry.weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7))) { throw new Error("彩蛋星期无效"); }
        }

        if (entries.length) { validWeights(entries.map((entry) => entry.weight)); }
    }

    return corpus;
}
export function validateSettings(config: DrawSettings, corpus?: FortuneCorpus) {
    validWeights(Object.keys(LEVELS).map((level) => config[`level_${level as keyof typeof LEVELS}`]));
    validWeights(RARITIES.map((rarity) => config[`rarity_${rarity}`]));

    if (THEMES.some((theme) => typeof config[`theme_${theme}`] !== "boolean") || typeof config.eggs !== "boolean") { throw new Error("主题和彩蛋开关格式错误"); }

    if (!THEMES.some((theme) => config[`theme_${theme}`])) { throw new Error("至少启用一个主题"); }

    if (corpus) { validateThemeCoverage(config, corpus); }
}
export function validateThemeCoverage(config: DrawSettings, corpus: FortuneCorpus) {
    for (const level of Object.keys(LEVELS) as (keyof typeof LEVELS)[]) {
        if (corpus.fortunes.length && config[`level_${level}`] > 0 && !corpus.fortunes.some((entry) => entry.level === level && entry.weight > 0 && config[`theme_${entry.theme}`])) { throw new Error("启用主题未覆盖等级：" + level); }
    }
}
