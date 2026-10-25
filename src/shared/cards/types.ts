export type CardFormat = "png" | "jpeg";
export type CardField = { key: string; label: string; sample: string };
export type CardDefinition = { id: string; title: string; width: 540; height: 300 | 850; fields: readonly CardField[]; presets: readonly { id: string; title: string; design: CardDesign }[]; samples: readonly { id: string; title: string; values: Record<string, string> }[] };
export type CardRegion = { id: string; field: string; text?: string; x: number; y: number; width: number; height: number; size: number; weight: 400 | 700; color: string; align: "left" | "center" | "right"; lineHeight: number };
export type CardDesign = { enabled: boolean; background: string; regions: CardRegion[] };
export type CardState = { revision: number; config: Record<string, CardDesign> };
export const ASSET_PREFIX = "card-editor/assets/";
const FONT_VERSION = "noto-cjk-f8d1575";
export const fontAsset = (weight: number) => `${FONT_VERSION}-${weight}.otf`;

export type CardAssets = Record<string, { height: number; url: string }>;
