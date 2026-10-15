import type { RouteInput } from "@qqbot/sdk";
import type { Ctx } from "../types.js";
import { ASSET_PREFIX, fontAsset } from "./types.js";
import { AdminError } from "../admin-errors.js";
const FONT_ROOT = "https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/OTF/SimplifiedChinese/";
export async function prepareFont(ctx: Ctx, weight: number) {
    if (weight !== 400 && weight !== 700) { throw new AdminError("validation", "字重无效"); }

    const asset = fontAsset(weight), key = ASSET_PREFIX + asset;

    if (await ctx.r2.head(key)) { return asset; }

    const response = await fetch(FONT_ROOT + `NotoSansCJKsc-${weight === 400 ? "Regular" : "Bold"}.otf`, { signal: AbortSignal.timeout(60_000), redirect: "manual" });

    if (!response.ok || !response.body || Number(response.headers.get("content-length")) > 20_000_000) {
        await response.body?.cancel();
        throw new Error("字体准备失败，请重试");
    }

    await ctx.r2.put(key, response.body, { contentType: "font/otf" });
    return asset;
}
export async function uploadBackground(ctx: Ctx, request: Request, owner: string, height: number) {
    // The browser decodes and normalizes uploads to the exact card dimensions before transferring them.
    const reader = request.body?.getReader();

    if (!reader) { throw new AdminError("validation", "请选择背景图片"); }

    const parts: Uint8Array[] = [];
    let length = 0;

    try {
        for (; ;) {
            const { done, value } = await reader.read();

            if (done) { break; }

            length += value.byteLength;

            if (length > 2_000_000) { throw new AdminError("validation", "背景最大 2 MB"); }

            parts.push(value);
        }
    } finally { await reader.cancel().catch(() => { }); reader.releaseLock(); }

    const bytes = new Uint8Array(length);
    let offset = 0;

    for (const part of parts) { bytes.set(part, offset); offset += part.length; }

    const view = new DataView(bytes.buffer);

    if (length < 45 || view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a || view.getUint32(12) !== 0x49484452 || view.getUint32(16) !== 540 || view.getUint32(20) !== height) { throw new AdminError("validation", "背景须为当前卡面尺寸的 PNG"); }

    const asset = `${owner}-${Date.now()}-${crypto.randomUUID()}.png`;
    await ctx.r2.put(ASSET_PREFIX + asset, bytes, { contentType: "image/png", metadata: { height: String(height) } });
    return asset;
}
export async function readAsset({ ctx, params }: RouteInput) {
    const asset = params.asset ?? "";

    if (![fontAsset(400), fontAsset(700)].includes(asset) && !/^[a-z][a-z0-9_-]*-[0-9]{13}-[0-9a-f-]{36}\.png$/.test(asset)) { return new Response(null, { status: 404 }); }

    const stream = await ctx.r2.getStream(ASSET_PREFIX + asset);
    return stream ? new Response(stream, { headers: { "content-type": asset.endsWith(".otf") ? "font/otf" : "image/png", "cache-control": "public,max-age=31536000,immutable", "access-control-allow-origin": "*", "x-content-type-options": "nosniff" } }) : new Response(null, { status: 404 });
}
