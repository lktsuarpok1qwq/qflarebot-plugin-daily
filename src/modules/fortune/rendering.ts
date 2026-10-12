import type { expand } from "../../shared/interpolation.js";
import type { FortuneCopy } from "./copy.js";
import type { FortuneDocument } from "./types.js";
/** Shared by command replies and browser samples; no external closure dependencies. */
export function renderFortune(copy: FortuneCopy, document: FortuneDocument, interpolate: typeof expand, decorate?: (key: keyof FortuneCopy, text: string) => string): string {
    if (document.kind !== "draw") { return decorate ? decorate(document.kind, copy[document.kind]) : copy[document.kind]; }

    const data = document.result;
    const fragments: Record<string, string> = {};
    const level = "level_" + data.entry.level as keyof FortuneCopy, rarity = "rarity_" + data.entry.rarity as keyof FortuneCopy;
    fragments.level = decorate ? decorate(level, copy[level]) : copy[level];
    fragments.rarity = decorate ? decorate(rarity, copy[rarity]) : copy[rarity];

    for (const kind of ["good", "bad"] as const) {
        let items = "";

        if (copy.body.includes("{{" + kind + "}}") && copy[kind]) {
            for (let i = 0; i < data[kind].length; i++) {
                const key = i === 0 ? "actionFirst" : "actionNext";
                const text = interpolate(copy[key], { text: data[kind][i]!.text });
                items += decorate ? decorate(key, text) : text;
            }
        }

        const text = data[kind].length ? interpolate(copy[kind], {}, { items }) : "";
        fragments[kind] = decorate ? decorate(kind, text) : text;
    }

    let effect = "";

    if (data.effect) {
        const kind = decorate ? decorate(data.effect.type, copy[data.effect.type]) : copy[data.effect.type];
        effect = interpolate(copy.effect, { name: data.effect.name, description: data.effect.description }, { kind });
    }

    const item = data.item ? interpolate(copy.item, { name: data.item.name, description: data.item.description }) : "";
    const egg = data.egg ? interpolate(copy.egg, { text: data.egg.text }) : "";
    fragments.effect = decorate ? decorate("effect", effect) : effect;
    fragments.item = decorate ? decorate("item", item) : item;
    fragments.egg = decorate ? decorate("egg", egg) : egg;
    const text = interpolate(copy.body, { date: data.date, score: String(data.score), title: data.entry.title, sign: data.entry.sign, explanation: data.entry.explanation }, fragments);
    return decorate ? decorate("body", text) : text;
}
