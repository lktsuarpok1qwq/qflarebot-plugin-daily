import type { Ctx } from "./types.js";

export function publicOrigin(ctx: Ctx): string {
    if (!ctx.publicUrl) { throw new Error("请在 QFlareBot 设置公开 HTTPS 地址"); }

    const url = new URL(ctx.publicUrl);

    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
        throw new Error("QFlareBot 公开地址须为 HTTPS 域名");
    }

    return url.origin;
}

export function imageOrigin(value: unknown): string {
    if (value === undefined || value === "") { return ""; }

    if (typeof value !== "string") { throw new Error("图片公开地址须为 HTTPS 域名"); }

    let url: URL;

    try { url = new URL(value); } catch { throw new Error("图片公开地址须为 HTTPS 域名"); }

    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
        throw new Error("图片公开地址须为 HTTPS 域名");
    }

    return url.origin;
}

export async function imageUrls(ctx: Ctx) {
    const row = await ctx.db.first<{ imagePublicUrl: string | null }>("SELECT json_extract(config,'$.imagePublicUrl') AS imagePublicUrl FROM {state} WHERE id=1");

    if (!row) { throw new Error("系统尚未初始化"); }

    const configured = imageOrigin(row.imagePublicUrl ?? "");
    const base = (configured || publicOrigin(ctx)) + `/p/${encodeURIComponent(ctx.plugin.name)}/`;

    return (key: string, route = key) => base + (configured ? key : route).split("/").map(encodeURIComponent).join("/");
}
