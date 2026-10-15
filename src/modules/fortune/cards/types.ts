import type { Level, Rarity } from "../types.js";
import type { CardTheme } from "./layout.js";

export type CardPhrase = { text: string; emphasis?: readonly string[] };
export type CardDetail = { name: string; description: CardPhrase };
export interface FortuneCardContent {
    theme: CardTheme;
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
export type FortuneEgg = CardPhrase & { id: string; theme?: CardTheme };
export type CorpusRange = readonly [pool: number, count: number];
export type FortuneHoliday = { id: string; name: string; date: string; eggs: CorpusRange };
export type FortuneCorpusIndex = {
    cards: Record<CardTheme, Record<Level, CorpusRange>>;
    ordinaryEggs: Record<CardTheme, CorpusRange>;
    holidays: FortuneHoliday[];
    sampleCard: readonly [pool: number, position: number];
    sampleEgg: readonly [pool: number, position: number];
    status: string;
};
