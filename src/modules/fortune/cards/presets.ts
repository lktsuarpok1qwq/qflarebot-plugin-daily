import type { CardDesign, CardRegion } from "../../../shared/cards/types.js";
import { CARD_PALETTES, CARD_THEMES, cardRegions, type CardTheme, type CardLayout } from "./layout.js";
import { THEME_NAMES } from "../copy.js";
export function fortuneDefault(theme: CardTheme, layout: CardLayout): CardDesign {
    const bounds = cardRegions(layout), colors = CARD_PALETTES[theme];
    const region = (id: string, field: string, size = 28, color: string = colors.text, weight: 400 | 700 = 400): CardRegion => ({
        ...bounds[id]!, id, field, size, weight, color, align: ["month", "day", "score"].includes(field) ? "right" : "left", lineHeight: size + 8,
    });
    const regions = [region("month", "month", 24, colors.muted), region("day", "day", 24, colors.muted), region("title", "title", 40, colors.text, 700), region("icon", "icon", 48),
    { ...region("result", "level", 40, colors.good, 700), align: "center" as const, y: 82 }, region("score", "score", 24), region("sign", "sign"), region("rarity", "rarity", 24, colors.rarity)];

    if (layout !== "small") {
        regions.push(region("explanation", "explanation"), region("good", "good"), region("bad", "bad"));

        for (const field of ["effect", "item"]) {
            const base = region(field, field + "_name", 28, colors.accent);
            regions.push({ ...base, height: 32 }, { ...base, id: field + "-text", field: field + "_text", y: base.y + 40, height: 62, size: 24, lineHeight: 30, color: colors.text });
        }

        if (layout === "egg") { regions.push(region("egg", "egg", 24)); }
    }

    return { enabled: true, background: `fortune-${theme}-${layout}-v1.webp`, regions };
}
export const fortunePresets = (view: "small" | "detail") => CARD_THEMES.flatMap(theme => (view === "small" ? ["small"] as const : ["detail", "egg"] as const).map(layout => ({ id: `${theme}-${layout}`, title: THEME_NAMES[theme] + (layout === "egg" ? " · 彩蛋" : ""), design: fortuneDefault(theme, layout) })));
