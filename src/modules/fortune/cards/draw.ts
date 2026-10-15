import { validDate } from "../../../shared/date.js";
import { corpus } from "../corpus.js";
import { choose, random } from "../random.js";
import { LEVELS, RARITIES, type DrawSettings } from "../types.js";
import { CARD_THEMES, type CardTheme } from "./layout.js";
import type { CardPhrase, FortuneCardContent, FortuneHoliday } from "./types.js";

export function holidayWindow(date: string): { holidays: FortuneHoliday[]; chance: number } {
    const year = Number(date.slice(0, 4)), today = Date.parse(date + "T00:00:00Z");
    let nearest = 8;
    let holidays: FortuneHoliday[] = [];

    for (const holiday of corpus.data.holidays) {
        for (const eventYear of [year, year + 1]) {
            const gap = (Date.parse(`${eventYear}-${holiday.date}T00:00:00Z`) - today) / 86400000;

            if (gap < 0 || gap > 7 || gap > nearest) { continue; }

            if (gap < nearest) { holidays = []; nearest = gap; }

            holidays.push(holiday);
        }
    }

    return { holidays, chance: holidays.length ? (8 - nearest) / 20 : 0 };
}

export function selectEgg(theme: CardTheme, date: string, chance: number, pick: () => number): CardPhrase | undefined {
    const window = holidayWindow(date);
    const holiday = choose(window.holidays, () => 1, pick);

    if (holiday && chance < window.chance) { return choose(holiday.eggs, () => 1, pick); }

    if (chance >= window.chance && chance < window.chance + 0.05) { return choose(corpus.data.ordinaryEggs.filter(egg => egg.theme === theme), () => 1, pick); }

    return undefined;
}

export function drawCard(user: string, date: string, config: DrawSettings): FortuneCardContent {
    if (!user.trim() || !validDate(date)) { throw new Error("用户标识或日期无效"); }

    const seed = user + ":" + date;
    const theme = choose(CARD_THEMES.filter(theme => config[`theme_${theme}`]), () => 1, random(seed + ":theme"));

    if (!theme) { throw new Error("没有启用可用的卡面主题"); }

    const level = choose(Object.keys(LEVELS) as (keyof typeof LEVELS)[], key => config[`level_${key}`], random(seed + ":level"))!;
    const rarity = choose(RARITIES, key => config[`rarity_${key}`], random(seed + ":rarity"))!;
    const story = choose(corpus.data.cards.filter(card => card.theme === theme && card.level === level), () => 1, random(seed + ":story"))!;
    const [min, max] = LEVELS[level];
    const egg = config.eggs ? selectEgg(theme, date, random(seed + ":egg-chance")(), random(seed + ":egg-pick")) : undefined;
    return {
        theme, date, level, rarity, score: min + Math.floor(random(seed + ":score")() * (max - min + 1)),
        title: story.title, icon: story.icon, sign: story.sign, explanation: story.explanation,
        good: story.good, bad: story.bad, effect: story.effect, item: story.item, ...(egg ? { egg } : {})
    };
}
