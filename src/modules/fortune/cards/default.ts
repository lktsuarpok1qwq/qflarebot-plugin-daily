import { textLayout } from "../../../shared/cards/layout.js";
import { CARD_PALETTES, FORTUNE_REGIONS } from "./layout.js";
import { LEVELS } from "../types.js";
import type { CardSnapshot } from "./store.js";
export function layoutFortune(snapshot: CardSnapshot, view: "small" | "detail") {
    const { content: c, labels } = snapshot;
    const kind = view === "small" ? "small" : c.egg ? "egg" : "detail";
    const regions = FORTUNE_REGIONS[kind], colors = CARD_PALETTES[c.theme], layout = textLayout();
    const add = (id: string, text: string, emphasis?: readonly string[], color?: string) => {
        const region = regions[id]!;
        layout.add(region, text, color ?? colors[region.color], emphasis?.length ? { words: emphasis, color: colors.accent } : undefined);
    };
    add("month", String(Number(c.date.slice(5, 7))));
    add("day", String(Number(c.date.slice(8))));
    add("title", c.title);
    add("icon", c.icon);
    add("result", labels.levels[c.level], undefined, LEVELS[c.level][0] >= 55 ? colors.good : colors.bad);
    add("score", String(c.score));
    add("sign", c.sign.text, c.sign.emphasis);
    add("rarity", labels.rarities[c.rarity]);

    if (view === "detail") {
        add("explanation", c.explanation.text, c.explanation.emphasis);
        add("good", c.good.join("\n"));
        add("bad", c.bad.join("\n"));
        add("effect", c.effect.name);
        add("effect-text", c.effect.description.text, c.effect.description.emphasis);
        add("item", c.item.name);
        add("item-text", c.item.description.text, c.item.description.emphasis);

        if (c.egg) { add("egg", c.egg.text, c.egg.emphasis); }
    }

    return { background: `fortune-${c.theme}-${kind}-v1.webp`, layout: layout.finish() };
}
