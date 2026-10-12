import fortunes from "./data/fortunes.json";
import actions from "./data/actions.json";
import effects from "./data/effects.json";
import items from "./data/items.json";
import eggs from "./data/easter-eggs.json";
import { validateCorpus } from "./validation.js";
import type { FortuneCorpus } from "./types.js";
const eggChance = 0.05;
function load(): { data?: FortuneCorpus; status: string } {
    try {
        const data = validateCorpus({ fortunes, actions, effects, items, eggs, eggChance });

        for (const pool of [data.fortunes, data.actions, data.effects, data.items, data.eggs]) { pool.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0); }

        return { data, status: data.fortunes.length ? "语料已接入" : "语料未接入" };
    } catch (error) { return { status: "语料校验失败：" + (error instanceof Error ? error.message : String(error)) }; }
}
export const corpus = load();
