import type { expand } from "../../../shared/interpolation.js";
import type { FortuneCopy } from "../copy.js";
import type { CardSnapshot } from "./store.js";

export function renderFortuneText(copy: FortuneCopy, view: "small" | "detail", snapshot: CardSnapshot, interpolate: typeof expand): string {
    const { content: c, labels } = snapshot;

    return interpolate(copy[view === "small" ? "drawText" : "detailText"], {
        title: c.title, date: c.date, level: labels.levels[c.level], score: String(c.score), rarity: labels.rarities[c.rarity], sign: c.sign.text,
        explanation: c.explanation.text, good1: c.good[0] ?? "", good2: c.good[1] ?? "", bad1: c.bad[0] ?? "", bad2: c.bad[1] ?? "",
        effect: c.effect.name, effect_text: c.effect.description.text, item: c.item.name, item_text: c.item.description.text, egg: view === "detail" ? c.egg?.text ?? "" : "",
    });
}
