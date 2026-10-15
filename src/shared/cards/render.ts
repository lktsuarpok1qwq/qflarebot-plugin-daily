import type { Ctx } from "../types.js";
import type { CardDesign, CardAssets } from "./types.js";
import { fontAsset } from "./types.js";
import { cardLayout, emojiURL, type CardHighlights, type CardLayoutResult } from "./layout.js";
import { publicOrigin } from "../public-origin.js";
export async function renderDesign(ctx: Ctx, design: CardDesign, values: Record<string, string>, signal: AbortSignal, assets: CardAssets, highlights: CardHighlights = {}): Promise<ReadableStream<Uint8Array>> {
    if (!design.background) { throw new Error("请先上传背景"); }

    return renderLayers(ctx, design.background, cardLayout(design, values, highlights), signal, assets);
}
export async function renderLayers(ctx: Ctx, background: string, { layers, overflow }: CardLayoutResult, signal: AbortSignal, assets: CardAssets): Promise<ReadableStream<Uint8Array>> {
    if (overflow.length) { throw new Error("文字超出区域，请调整字号或区域大小"); }

    const base = `${publicOrigin(ctx)}/p/${encodeURIComponent(ctx.plugin.name)}/cards/assets/`;
    const draw = layers.map(layer => ({
        left: layer.left, top: layer.top, ...(layer.emoji
            ? { url: emojiURL(layer.emoji), width: layer.size, height: layer.size, fit: "contain" }
            : { text: layer.text, size: layer.size, color: layer.color, font: { url: base + fontAsset(layer.weight) } })
    }));
    // Use the public URL transformation path; Images fetches resources without JS multipart assembly.
    const options = { signal, redirect: "manual" as const, cf: { image: { format: "png", quality: 100, draw } } };
    const response = await fetch(assets[background]?.url ?? base + background, options as RequestInit);

    if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("image/png") || /\berr=/.test(response.headers.get("cf-resized") ?? "")) {
        await response.body?.cancel();
        const code = /\berr=(\d+)/.exec(response.headers.get("cf-resized") ?? "")?.[1];
        const ray = response.headers.get("cf-ray");
        throw new Error(`Images 渲染失败（HTTP ${response.status}${code ? ", err=" + code : ""}${ray && /^[\w-]{1,80}$/.test(ray) ? ", Ray " + ray : ""}）`);
    }
    // A plain fetch on a local runtime can return the original image while ignoring cf.image.
    if (!response.headers.has("cf-resized")) {
        await response.body.cancel();
        throw new Error("当前环境未执行 Images 转换，请在已启用 Images 的公开 HTTPS 环境预览");
    }

    return response.body;
}
