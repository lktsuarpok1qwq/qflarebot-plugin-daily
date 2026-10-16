import type { CardDesign } from "../../../shared/cards/types.js";
import { CARD_PALETTES, FORTUNE_REGIONS, type CardLayout } from "./layout.js";
import { THEMES, type Theme } from "../types.js";
import { THEME_NAMES } from "../copy.js";
export function fortuneDefault(theme: Theme, layout: CardLayout): CardDesign {
    const colors = CARD_PALETTES[theme];
    return { enabled: true, background: `fortune-${theme}-${layout}-v1.webp`, regions: Object.values(FORTUNE_REGIONS[layout]).map(region => ({ ...region, color: colors[region.color] })) };
}
export const fortunePresets = (view: "small" | "detail") => THEMES.flatMap(theme => (view === "small" ? ["small"] as const : ["detail", "egg"] as const).map(layout => ({ id: `${theme}-${layout}`, title: THEME_NAMES[theme] + (layout === "egg" ? " · 彩蛋" : ""), get design() { return fortuneDefault(theme, layout); } })));
