import { validDate } from "../../shared/date.js";
import { choose, random } from "./random.js";
import { LEVELS, RARITIES, type DrawSettings, type FortuneCorpus, type FortuneResult } from "./types.js";
import { validateSettings } from "./validation.js";
function matching<T extends { tags: string[]; weight: number }>(pool: readonly T[], tags: Set<string>): T[][] {
    const specific = pool.filter((entry) => entry.weight > 0 && entry.tags.some((tag) => tag !== "general" && tags.has(tag)));
    const selected = new Set(specific);
    return [specific, pool.filter((entry) => entry.weight > 0 && !selected.has(entry) && entry.tags.includes("general"))];
}
export function generateFortune(input: { userId: string; date: string; config: DrawSettings; corpus: FortuneCorpus; parts?: ReadonlySet<string> }): FortuneResult | undefined {
    const { userId, date, config, corpus, parts } = input;

    if (!userId.trim() || !validDate(date)) { throw new Error("用户标识或日期无效"); }

    validateSettings(config, corpus);

    if (!corpus.fortunes.length) { return undefined; }

    const seed = userId + ":" + date;
    const level = choose(Object.keys(LEVELS) as (keyof typeof LEVELS)[], (key) => config[`level_${key}`], random(seed + ":level"))!;
    const rarity = choose(RARITIES, (key) => config[`rarity_${key}`], random(seed + ":rarity"))!;
    const candidates = corpus.fortunes.filter((entry) => entry.level === level && config[`theme_${entry.theme}`] && entry.weight > 0);
    const preferred = candidates.filter((entry) => entry.rarity === rarity);
    const entry = choose(preferred.length ? preferred : candidates, (entry) => entry.weight, random(seed + ":fortune"))!;
    const [min, max] = LEVELS[level];
    const result: FortuneResult = { date, entry, score: min + Math.floor(random(seed + ":score")() * (max - min + 1)), good: [], bad: [] };
    const tags = new Set([entry.theme, ...entry.tags]), texts = new Set<string>();

    for (const kind of ["good", "bad"] as const) {
        if (parts && !parts.has(kind) && !(kind === "good" && parts.has("bad"))) { continue; }

        const rng = random(seed + ":" + kind + "-actions");

        for (const pool of matching(corpus.actions.filter((action) => action.kind === kind), tags)) {
            let remaining = pool.filter((action) => !texts.has(action.text.trim()));

            while (remaining.length && result[kind].length < 2) {
                const action = choose(remaining, (item) => item.weight, rng)!;
                result[kind].push(action); texts.add(action.text.trim());
                remaining = remaining.filter((item) => !texts.has(item.text.trim()));
            }
        }
    }

    if (!parts || parts.has("effect")) {
        const pools = matching(corpus.effects, tags);
        result.effect = choose(pools[0]!.length ? pools[0]! : pools[1]!, (item) => item.weight, random(seed + ":effect"));
    }

    if (!parts || parts.has("item")) {
        const pools = matching(corpus.items, tags);
        result.item = choose(pools[0]!.length ? pools[0]! : pools[1]!, (item) => item.weight, random(seed + ":item"));
    }

    const eggRandom = random(seed + ":egg");

    if ((!parts || parts.has("egg")) && config.eggs && corpus.eggChance > 0 && eggRandom() < corpus.eggChance) {
        const weekday = new Date(date).getUTCDay() || 7;
        const pools = matching(corpus.eggs.filter((egg) => (!egg.dates || egg.dates.includes(date.slice(5))) && (!egg.weekdays || egg.weekdays.includes(weekday))), tags);
        result.egg = choose(pools[0]!.length ? pools[0]! : pools[1]!, (item) => item.weight, eggRandom);
    }

    return result;
}
