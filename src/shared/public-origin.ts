import type { Ctx } from "./types.js";
export function publicOrigin(ctx: Ctx): string {
    if (!ctx.publicUrl) { throw new Error("请在 QFlareBot 设置公开 HTTPS 地址"); }

    const url = new URL(ctx.publicUrl);

    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
        throw new Error("QFlareBot 公开地址须为 HTTPS 域名");
    }

    return url.origin;
}
