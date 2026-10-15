import type { CardDesign } from "../../../shared/cards/types.js";
import { CARD_PALETTES, CARD_THEMES, FORTUNE_REGIONS, type CardTheme, type CardLayout } from "./layout.js";
import { THEME_NAMES } from "../copy.js";
export function fortuneDefault(theme: CardTheme, layout: CardLayout): CardDesign {
    const colors = CARD_PALETTES[theme];
    return { enabled: true, background: `fortune-${theme}-${layout}-v1.webp`, regions: Object.values(FORTUNE_REGIONS[layout]).map(region => ({ ...region, color: colors[region.color] })) };
}
export const fortunePresets = (view: "small" | "detail") => CARD_THEMES.flatMap(theme => (view === "small" ? ["small"] as const : ["detail", "egg"] as const).map(layout => ({ id: `${theme}-${layout}`, title: THEME_NAMES[theme] + (layout === "egg" ? " · 彩蛋" : ""), get design() { return fortuneDefault(theme, layout); } })));
