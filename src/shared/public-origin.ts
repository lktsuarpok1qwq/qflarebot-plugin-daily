import type { Ctx } from "./types.js";
export function publicOrigin(ctx: Ctx): string {
    if (!ctx.publicUrl) { throw new Error("请在 QFlareBot 设置公开 HTTPS 地址"); }

    const url = new URL(ctx.publicUrl);

    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
        throw new Error("QFlareBot 公开地址须为 HTTPS 域名");
    }

    return url.origin;
}
export function storedImageUrl(ctx: Ctx, key: string, route = key): string {
    const configured = (ctx.config as { imagePublicUrl?: unknown } | null)?.imagePublicUrl;
    const prefix = `/p/${encodeURIComponent(ctx.plugin.name)}/`;

    if (configured === undefined || configured === "") { return publicOrigin(ctx) + prefix + route; }

    if (typeof configured !== "string") { throw new Error("图片公开地址须为 HTTPS 域名"); }

    let url: URL;

    try { url = new URL(configured); } catch { throw new Error("图片公开地址须为 HTTPS 域名"); }

    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
        throw new Error("图片公开地址须为 HTTPS 域名");
    }

    return url.origin + prefix + key.split("/").map(encodeURIComponent).join("/");
}
