import type { Region } from "../../../shared/t2i/index.js";

export const CARD_THEMES = ["absurd", "gaming", "daily", "student", "mystic"] as const;
export type CardTheme = typeof CARD_THEMES[number];
export type CardLayout = "small" | "detail" | "egg";
export const CARD_LIMITS = { title: 6, sign: 24, explanation: 32, action: 8, name: 6, description: 16, egg: 36 } as const;
export const CARD_SIZES = { title: 40, body: 28, secondary: 24, icon: 48 } as const;

const common = {
    header: { x: 26, y: 18, width: 240, height: 42 }, date: { x: 316, y: 18, width: 198, height: 42 },
    title: { x: 26, y: 72, width: 256, height: 58 }, icon: { x: 296, y: 78, width: 48, height: 48 },
    result: { x: 386, y: 70, width: 128, height: 126 }, sign: { x: 26, y: 144, width: 344, height: 84 },
    rarity: { x: 26, y: 240, width: 250, height: 42 }
} satisfies Record<string, Region>;

export function cardLayoutRegions(layout: CardLayout): Record<string, Region> {
    const regions: Record<string, Region> = Object.fromEntries(Object.entries(common).map(([key, region]) => [key, { ...region }]));

    if (layout === "small") { return regions; }

    const withEgg = layout === "egg";
    regions.explanation = { x: 26, y: 300, width: 488, height: 114 };
    regions.good = { x: 26, y: withEgg ? 430 : 458, width: 228, height: 116 };
    regions.bad = { x: 286, y: withEgg ? 430 : 458, width: 228, height: 116 };
    regions.effect = { x: 26, y: withEgg ? 564 : 640, width: 228, height: 140 };
    regions.item = { x: 286, y: withEgg ? 564 : 640, width: 228, height: 140 };

    if (withEgg) { regions.egg = { x: 26, y: 716, width: 488, height: 110 }; }

    return regions;
}

/** 只编码运行时会改动的区域，固定标题与图标保留在压缩背景中 */
export function cardRegions(layout: CardLayout): Record<string, Region> {
    const regions = cardLayoutRegions(layout);
    delete regions.header;
    delete regions.date;
    regions.month = { x: 316, y: 18, width: 36, height: 42 };
    regions.day = { x: 392, y: 18, width: 36, height: 42 };
    regions.result!.height = 65;
    regions.score = { x: 390, y: 142, width: 50, height: 36 };
    regions.rarity!.x += 40;
    regions.rarity!.width -= 40;

    for (const [name, offset] of [["explanation", 40], ["good", 38], ["bad", 38], ["effect", 38], ["item", 38], ["egg", 38]] as const) {
        const region = regions[name];

        if (region) { region.y += offset; region.height -= offset; }
    }

    return regions;
}

export const CARD_PALETTES = {
    absurd: { paper: "#fff5d2", text: "#33342f", muted: "#60615a", accent: "#b7590a", border: "#9a9990", good: "#2c7639", bad: "#b34639", rarity: "#8150a5", decoration: "#e6a14d" },
    gaming: { paper: "#11192e", text: "#eef2fa", muted: "#b7becd", accent: "#65caff", border: "#a7adba", good: "#8de4a3", bad: "#ffa48e", rarity: "#c7a5f1", decoration: "#456998" },
    daily: { paper: "#fcf7ef", text: "#393e43", muted: "#65676a", accent: "#b65342", border: "#aaa19a", good: "#377848", bad: "#b0463f", rarity: "#86539c", decoration: "#e9b4a3" },
    student: { paper: "#f0f8ee", text: "#283831", muted: "#57685e", accent: "#286849", border: "#a4aca6", good: "#277244", bad: "#b04340", rarity: "#8155a0", decoration: "#b4d0b2" },
    mystic: { paper: "#10213b", text: "#f0f1f7", muted: "#bac3d4", accent: "#f4cd71", border: "#a8adbc", good: "#b7e59c", bad: "#ffa68f", rarity: "#ceadf4", decoration: "#c3a86c" }
} as const;
