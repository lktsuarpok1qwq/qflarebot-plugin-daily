import type { Diagnostics } from "../diagnostics.js";
import type { Ctx } from "../types.js";
import type { CardDesign, CardAssets, CardFormat } from "./types.js";
import { ASSET_PREFIX, fontAsset } from "./types.js";
import { cardLayout, emojiURL, type CardHighlights, type CardLayoutResult } from "./layout.js";
import { imageUrls } from "../public-origin.js";
export class CardImageError extends Error {
    constructor(readonly stage: string, cause: unknown, readonly diagnostics: Diagnostics) {
        super(String(cause), { cause });
        this.name = "CardImageError";
    }
}
export async function renderDesign(ctx: Ctx, design: CardDesign, values: Record<string, string>, signal: AbortSignal, assets: CardAssets, highlights: CardHighlights = {}, format: CardFormat = "png"): Promise<ReadableStream<Uint8Array>> {
    if (!design.background) { throw new Error("请先上传背景"); }

    const urls = await imageUrls(ctx);
    return renderLayers(urls(ASSET_PREFIX, "cards/assets/"), design.background, cardLayout(design, values, highlights), signal, assets, format);
}
export async function renderLayers(base: string, background: string, { layers, overflow }: CardLayoutResult, signal: AbortSignal, assets: CardAssets, format: CardFormat = "png"): Promise<ReadableStream<Uint8Array>> {
    if (overflow.length) { throw new Error("文字超出区域，请调整字号或区域大小"); }

    const draw = layers.map(layer => ({
        left: layer.left, top: layer.top, ...(layer.emoji
            ? { url: emojiURL(layer.emoji), width: layer.size, height: layer.size, fit: "contain" }
            : { text: layer.text, size: layer.size, color: layer.color, font: { url: base + fontAsset(layer.weight) } })
    }));
    // Use the public URL transformation path; Images fetches resources without JS multipart assembly.
    const options = { signal, redirect: "manual" as const, cf: { image: { format, quality: format === "jpeg" ? 90 : 100, draw } } };
    const response = await fetch(assets[background]?.url ?? base + background, options as RequestInit);

    if (!response.ok || !response.body || response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== `image/${format}` || /\berr=/.test(response.headers.get("cf-resized") ?? "")) {
        await response.body?.cancel().catch(() => { });
        const code = /\berr=(\d+)/.exec(response.headers.get("cf-resized") ?? "")?.[1];
        const ray = response.headers.get("cf-ray");
        const cfRay = ray && /^[\w-]{1,80}$/.test(ray) ? ray : null;
        throw Object.assign(new Error(`Images 渲染失败（HTTP ${response.status}${code ? ", err=" + code : ""}${cfRay ? ", Ray " + cfRay : ""}）`), {
            status: response.status, code: code ? Number(code) : null, cfRay,
        });
    }
    // A plain fetch on a local runtime can return the original image while ignoring cf.image.
    if (!response.headers.has("cf-resized")) {
        await response.body.cancel().catch(() => { });
        throw Object.assign(new Error("当前环境未执行 Images 转换，请在已启用 Images 的公开 HTTPS 环境预览"), { status: response.status, code: "IMAGES_TRANSFORM_MISSING" });
    }

    return response.body;
}
