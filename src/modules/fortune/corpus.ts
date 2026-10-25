import { index, entries } from "./data/corpus.js";
import type { CorpusRange, FortuneCardEntry, FortuneEgg } from "./cards/types.js";
import type { Level, Theme } from "./types.js";

function read(pool: number, position: number): unknown {
    return JSON.parse(entries[pool]!(position));
}

function pick(range: CorpusRange, value: number): unknown {
    return read(range[0], Math.floor(value * range[1]));
}

// 固定语料按发布前生成的范围取一条，后台样例只在序列化或展示时解析
export const corpus = {
    ...index,
    get sampleCard(): FortuneCardEntry { return read(...index.sampleCard) as FortuneCardEntry; },
    get sampleEgg(): FortuneEgg { return read(...index.sampleEgg) as FortuneEgg; }
};

export function readStory(theme: Theme, level: Level, value: number): FortuneCardEntry {
    return pick(index.cards[theme][level], value) as FortuneCardEntry;
}

export function readEgg(range: CorpusRange, value: number): FortuneEgg {
    return pick(range, value) as FortuneEgg;
}
