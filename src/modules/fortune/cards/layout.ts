import type { CardRegion } from "../../../shared/cards/types.js";
export type CardLayout = "small" | "detail" | "egg";
type DefaultRegion = Omit<CardRegion, "color"> & { color: "text" | "muted" | "good" | "rarity" | "accent" };
const small: Readonly<Record<string, DefaultRegion>> = {
    "month": { x: 316, y: 24, width: 36, height: 36, id: "month", field: "month", size: 24, weight: 400, color: "muted", align: "right", lineHeight: 32 },
    "day": { x: 392, y: 24, width: 36, height: 36, id: "day", field: "day", size: 24, weight: 400, color: "muted", align: "right", lineHeight: 32 },
    "title": { x: 26, y: 72, width: 256, height: 58, id: "title", field: "title", size: 40, weight: 700, color: "text", align: "left", lineHeight: 48 },
    "icon": { x: 296, y: 78, width: 48, height: 48, id: "icon", field: "icon", size: 48, weight: 400, color: "text", align: "left", lineHeight: 56 },
    "result": { x: 386, y: 82, width: 128, height: 65, id: "result", field: "level", size: 40, weight: 700, color: "good", align: "center", lineHeight: 48 },
    "score": { x: 390, y: 148, width: 50, height: 30, id: "score", field: "score", size: 24, weight: 400, color: "text", align: "right", lineHeight: 32 },
    "sign": { x: 26, y: 144, width: 344, height: 84, id: "sign", field: "sign", size: 28, weight: 400, color: "text", align: "left", lineHeight: 36 },
    "rarity": { x: 66, y: 240, width: 210, height: 42, id: "rarity", field: "rarity", size: 24, weight: 400, color: "rarity", align: "left", lineHeight: 32 }
};
const detail: Readonly<Record<string, DefaultRegion>> = {
    ...small,
    "explanation": { x: 26, y: 340, width: 488, height: 74, id: "explanation", field: "explanation", size: 28, weight: 400, color: "text", align: "left", lineHeight: 36 },
    "good": { x: 26, y: 496, width: 228, height: 78, id: "good", field: "good", size: 28, weight: 400, color: "text", align: "left", lineHeight: 36 },
    "bad": { x: 286, y: 496, width: 228, height: 78, id: "bad", field: "bad", size: 28, weight: 400, color: "text", align: "left", lineHeight: 36 },
    "effect": { x: 26, y: 678, width: 228, height: 32, id: "effect", field: "effect_name", size: 28, weight: 400, color: "accent", align: "left", lineHeight: 36 },
    "effect-text": { x: 26, y: 718, width: 228, height: 62, id: "effect-text", field: "effect_text", size: 24, weight: 400, color: "text", align: "left", lineHeight: 30 },
    "item": { x: 286, y: 678, width: 228, height: 32, id: "item", field: "item_name", size: 28, weight: 400, color: "accent", align: "left", lineHeight: 36 },
    "item-text": { x: 286, y: 718, width: 228, height: 62, id: "item-text", field: "item_text", size: 24, weight: 400, color: "text", align: "left", lineHeight: 30 }
};
const egg: Readonly<Record<string, DefaultRegion>> = {
    ...small,
    "explanation": { x: 26, y: 340, width: 488, height: 74, id: "explanation", field: "explanation", size: 28, weight: 400, color: "text", align: "left", lineHeight: 36 },
    "good": { x: 26, y: 468, width: 228, height: 78, id: "good", field: "good", size: 28, weight: 400, color: "text", align: "left", lineHeight: 36 },
    "bad": { x: 286, y: 468, width: 228, height: 78, id: "bad", field: "bad", size: 28, weight: 400, color: "text", align: "left", lineHeight: 36 },
    "effect": { x: 26, y: 602, width: 228, height: 32, id: "effect", field: "effect_name", size: 28, weight: 400, color: "accent", align: "left", lineHeight: 36 },
    "effect-text": { x: 26, y: 642, width: 228, height: 62, id: "effect-text", field: "effect_text", size: 24, weight: 400, color: "text", align: "left", lineHeight: 30 },
    "item": { x: 286, y: 602, width: 228, height: 32, id: "item", field: "item_name", size: 28, weight: 400, color: "accent", align: "left", lineHeight: 36 },
    "item-text": { x: 286, y: 642, width: 228, height: 62, id: "item-text", field: "item_text", size: 24, weight: 400, color: "text", align: "left", lineHeight: 30 },
    "egg": { x: 26, y: 754, width: 488, height: 72, id: "egg", field: "egg", size: 24, weight: 400, color: "text", align: "left", lineHeight: 32 }
};
export const FORTUNE_REGIONS = { small, detail, egg };
export const CARD_PALETTES = {
    absurd: { paper: "#fff5d2", text: "#33342f", muted: "#60615a", accent: "#b7590a", border: "#9a9990", good: "#2c7639", bad: "#b34639", rarity: "#8150a5", decoration: "#e6a14d" },
    gaming: { paper: "#11192e", text: "#eef2fa", muted: "#b7becd", accent: "#65caff", border: "#a7adba", good: "#8de4a3", bad: "#ffa48e", rarity: "#c7a5f1", decoration: "#456998" },
    daily: { paper: "#fcf7ef", text: "#393e43", muted: "#65676a", accent: "#b65342", border: "#aaa19a", good: "#377848", bad: "#b0463f", rarity: "#86539c", decoration: "#e9b4a3" },
    student: { paper: "#f0f8ee", text: "#283831", muted: "#57685e", accent: "#286849", border: "#a4aca6", good: "#277244", bad: "#b04340", rarity: "#8155a0", decoration: "#b4d0b2" },
    mystic: { paper: "#10213b", text: "#f0f1f7", muted: "#bac3d4", accent: "#f4cd71", border: "#a8adbc", good: "#b7e59c", bad: "#ffa68f", rarity: "#ceadf4", decoration: "#c3a86c" }
} as const;
