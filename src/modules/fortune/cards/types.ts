import type { Level, Rarity, Theme } from "../types.js";

export type CardPhrase = { text: string; emphasis?: readonly string[] };
type CardDetail = { name: string; description: CardPhrase };
export interface FortuneCardContent {
    theme: Theme;
    date: string;
    level: Level;
    score: number;
    rarity: Rarity;
    title: string;
    icon: string;
    sign: CardPhrase;
    explanation: CardPhrase;
    good: readonly string[];
    bad: readonly string[];
    effect: CardDetail;
    item: CardDetail;
    egg?: CardPhrase;
}

export interface FortuneCardLabels {
    levels: Record<Level, string>;
    rarities: Record<Rarity, string>;
}

export type FortuneCardEntry = Omit<FortuneCardContent, "date" | "score" | "rarity" | "egg"> & { id: string };
export type FortuneEgg = CardPhrase & { id: string; theme?: Theme };
export type CorpusRange = readonly [pool: number, count: number];
export type FortuneHoliday = { id: string; name: string; date: string; eggs: CorpusRange };
export type FortuneCorpusIndex = {
    cards: Record<Theme, Record<Level, CorpusRange>>;
    ordinaryEggs: Record<Theme, CorpusRange>;
    holidays: FortuneHoliday[];
    sampleCard: readonly [pool: number, position: number];
    sampleEgg: readonly [pool: number, position: number];
    status: string;
};
