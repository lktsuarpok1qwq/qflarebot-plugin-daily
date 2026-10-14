import type { Route, RouteInput } from "@qqbot/sdk";
import type { Ctx } from "../../../shared/types.js";
import { addDays, dateAt, validDate } from "../../../shared/date.js";
import { renderer } from "./renderer.js";
import { fortuneCardRequest } from "./request.js";
import type { CardRow, CardSnapshot } from "./store.js";
const PREFIX = "fortune/cards/";
const key = (day: string, token: string, view: string) => `${PREFIX}${day}/${token}/${view}.png`;
export function publicOrigin(ctx: Ctx): string {
    if (!ctx.publicUrl) { throw new Error("请在 QFlareBot 设置公开 HTTPS 地址"); }

    const url = new URL(ctx.publicUrl);

    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
        throw new Error("QFlareBot 公开地址须为 HTTPS 域名");
    }

    return url.origin;
}
export async function cardImage(ctx: Ctx, row: CardRow, view: "small" | "detail", origin: string) {
    const deadline = Date.now() + 10_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expired = false;
    const check = () => {
        if (expired || Date.now() >= deadline) { throw new Error("运势图片准备超时"); }
    };
    const prepare = async () => {
        const path = key(row.day, row.token, view);
        const existing = await ctx.r2.head(path);
        check();

        if (!existing) {
            const snapshot = JSON.parse(row.snapshot) as CardSnapshot;
            const result = await renderer.render(fortuneCardRequest(snapshot.content, view, snapshot.labels));
            check();

            if (!result.ok) { throw new Error(`运势卡生成失败：${result.code} ${result.error}`); }

            await ctx.r2.put(path, result.data, { contentType: "image/png" });
            check();
        }

        return `${origin}/p/${encodeURIComponent(ctx.plugin.name)}/fortune/cards/${row.day}/${row.token}/${view}`;
    };

    try {
        return await Promise.race([prepare(), new Promise<never>((_, reject) => {
            timer = setTimeout(() => { expired = true; reject(new Error("运势图片准备超时")); }, 10_000);
        })]);
    } finally {
        if (timer !== undefined) { clearTimeout(timer); }
    }
}

async function readImage({ ctx, params }: RouteInput) {
    const { day = "", token = "", view = "" } = params, today = dateAt(Date.now());

    if (!validDate(day) || day < addDays(today, -1) || day > today || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(token) || !["small", "detail"].includes(view)) {
        return new Response(null, { status: 404 });
    }

    const stream = await ctx.r2.getStream(key(day, token, view));
    return stream ? new Response(stream, { headers: { "content-type": "image/png", "cache-control": "public, max-age=3600", "x-content-type-options": "nosniff" } }) : new Response(null, { status: 404 });
}
export const cardRoutes: Route[] = [{ method: "GET", path: "/fortune/cards/:day/:token/:view", auth: "public", handler: readImage }];
export async function cleanupCards(ctx: Ctx, now: number) {
    const cutoff = addDays(dateAt(now), -1);

    for (; ;) {
        const objects = await ctx.r2.list(PREFIX, { limit: 1000 });
        const expired = objects.filter(object => object.key.slice(PREFIX.length, PREFIX.length + 10) < cutoff).map(object => object.key);

        if (expired.length) { await ctx.r2.delete(expired); }

        // SDK lists keys in order; after deleting a full expired page, read the next one.
        if (objects.length < 1000 || expired.length < objects.length) { break; }
    }

    await ctx.db.run("DELETE FROM {fortune_cards} WHERE day<?", cutoff);
}
