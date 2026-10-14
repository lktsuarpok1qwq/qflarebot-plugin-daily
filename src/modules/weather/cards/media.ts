import type { Route, RouteInput } from "@qqbot/sdk";
import type { Ctx } from "../../../shared/types.js";
import { publicOrigin } from "../../../shared/public-origin.js";
import { dateAt, addDays, validDate } from "../../../shared/date.js";
import type { WeatherCardCopy, WeatherCardData } from "./copy.js";
const PREFIX = "weather/cards/";
export async function weatherImage(ctx: Ctx, data: WeatherCardData, copy: WeatherCardCopy) {
    const day = dateAt(Date.now()), token = crypto.randomUUID();
    const deadline = Date.now() + 10_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expired = false, stage = "public_address";
    const check = () => {
        if (expired || Date.now() >= deadline) { throw new Error("天气图片准备超时"); }
    };
    const prepare = async () => {
        const origin = publicOrigin(ctx);
        stage = "render";
        const { renderWeatherCard } = await import("./renderer.js");
        check();
        const image = await renderWeatherCard(data, copy);
        check();

        if (!image.ok) { throw new Error(`${image.code}: ${image.error}`); }

        stage = "image_save";
        await ctx.r2.put(`${PREFIX}${day}/${token}.png`, image.data, { contentType: "image/png" });
        check();
        return `${origin}/p/${encodeURIComponent(ctx.plugin.name)}/weather/cards/${day}/${token}`;
    };

    try {
        return await Promise.race([prepare(), new Promise<never>((_, reject) => {
            timer = setTimeout(() => { expired = true; reject(new Error("天气图片准备超时")); }, 10_000);
        })]);
    } catch (error) {
        ctx.logger.warn("天气图片准备失败，使用文字回复", { stage, error: String(error) });
        throw error;
    } finally {
        if (timer !== undefined) { clearTimeout(timer); }
    }
}
async function readImage({ ctx, params }: RouteInput) {
    const { day = "", token = "" } = params, today = dateAt(Date.now());

    if (!validDate(day) || day < addDays(today, -1) || day > today || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(token)) {
        return new Response(null, { status: 404 });
    }

    const stream = await ctx.r2.getStream(`${PREFIX}${day}/${token}.png`);
    return stream ? new Response(stream, { headers: { "content-type": "image/png", "cache-control": "public, max-age=3600", "x-content-type-options": "nosniff" } }) : new Response(null, { status: 404 });
}
export const weatherCardRoutes: Route[] = [{ method: "GET", path: "/weather/cards/:day/:token", auth: "public", handler: readImage }];
export async function cleanupWeatherImages(ctx: Ctx, now: number) {
    const cutoff = addDays(dateAt(now), -1);

    for (; ;) {
        const objects = await ctx.r2.list(PREFIX, { limit: 1000 });
        const expired = objects.filter(object => object.key.slice(PREFIX.length, PREFIX.length + 10) < cutoff).map(object => object.key);

        if (expired.length) { await ctx.r2.delete(expired); }

        if (objects.length < 1000 || expired.length < objects.length) { break; }
    }
}
