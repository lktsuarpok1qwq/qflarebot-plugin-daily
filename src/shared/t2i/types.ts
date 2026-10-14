export type TextAlign = "left" | "center" | "right";
export type IconName = "check" | "cross" | "star" | "info" | "arrow-up" | "arrow-down";

export interface Region {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface TextRun {
    text: string;
    color?: string;
}

interface TextStyle {
    type: "text";
    region?: string;
    x: number;
    y: number;
    size?: number;
    color?: string;
    weight?: 400 | 700;
    align?: TextAlign;
    maxWidth?: number;
    lineHeight?: number;
}

export type TextElement = TextStyle & ({ text: string; runs?: never } | { text?: never; runs: TextRun[] });

export interface EmojiElement {
    type: "emoji";
    region?: string;
    value: string;
    x: number;
    y: number;
    size?: number;
}

export interface IconElement {
    type: "icon";
    region?: string;
    name: IconName;
    x: number;
    y: number;
    size?: number;
    color?: string;
}

export type RenderElement = TextElement | EmojiElement | IconElement;
export interface T2IRequest {
    background: string;
    elements: RenderElement[];
}

export type T2IErrorCode = "INVALID_INPUT" | "UNSUPPORTED_CONTENT" | "RENDER_FAILED" | "RESOURCE_LIMIT";
export type T2IResult =
    | { ok: true; data: Uint8Array; mimeType: "image/png"; width: number; height: number }
    | { ok: false; code: T2IErrorCode; error: string };

export interface BackgroundInfo {
    id: string;
    width: number;
    height: number;
    description: string;
    regions?: Record<string, Region>;
}

export interface T2IService {
    /** 返回副本，修改不会改变内置素材 */
    backgrounds(): BackgroundInfo[];
    /** 当前预生成的字体组合及字符范围；返回副本 */
    fonts(): FontInfo[];
    render(request: T2IRequest): Promise<T2IResult>;
}

export interface FontInfo {
    size: number;
    weight: 400 | 700;
    characters: string;
}
