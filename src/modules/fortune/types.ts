export const LEVELS = { great: [85, 100], good: [70, 84], small: [55, 69], neutral: [40, 54], bad: [20, 39], worst: [0, 19] } as const;
export const RARITIES = ["common", "rare", "epic", "legendary"] as const;
export const THEMES = ["absurd", "gaming", "daily", "student", "mystic"] as const;
export type Level = keyof typeof LEVELS;
export type Rarity = typeof RARITIES[number];
export type Theme = typeof THEMES[number];
export type DrawSettings = Record<`level_${Level}` | `rarity_${Rarity}`, number> & Record<`theme_${Theme}` | "eggs", boolean>;
