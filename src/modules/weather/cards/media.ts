import { cleanupDatedObjects } from "../../../shared/dated-objects.js";
import { cardLayout } from "../../../shared/cards/layout.js";
import { errorDetails, type Diagnostics } from "../../../shared/diagnostics.js";
import { backgrounds } from "./backgrounds/index.js";
import { ASSET_PREFIX, type CardState } from "../../../shared/cards/types.js";
import { CardImageError, renderLayers } from "../../../shared/cards/render.js";
import { layoutWeather } from "./default.js";
import { weatherDesignValues } from "./design.js";
import type { Route, RouteInput } from "@qqbot/sdk";
import type { Ctx } from "../../../shared/types.js";
import { imageUrls } from "../../../shared/public-origin.js";
import { dateAt, addDays, validDate } from "../../../shared/date.js";
import type { WeatherCardCopy, WeatherCardData } from "./copy.js";
const PREFIX = "weather/cards/";
export async function weatherImage(ctx: Ctx, userId: string, data: WeatherCardData, copy: WeatherCardCopy, state?: CardState) {
    const day = dateAt(Date.now()), token = crypto.randomUUID();
    const deadline = Date.now() + 10_000;
    const diagnostics: Diagnostics = { imageFormat: "jpeg", imageCache: "disabled", imageSaved: false };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expired = false, stage = "public_address";
    const check = () => {
        if (expired || Date.now() >= deadline) { throw new DOMException("天气图片准备超时", "TimeoutError"); }
    };
    const prepare = async () => {
        const path = `${PREFIX}${day}/${encodeURIComponent(userId)}-${token}.jpg`;
        diagnostics.imageKey = path;
        const urls = await imageUrls(ctx);
        const url = urls(path);
        diagnostics.imageHost = new URL(url).hostname;
        stage = "layout";
        const design = state?.config.weather;

        const signal = AbortSignal.timeout(Math.max(1, deadline - Date.now()));
        diagnostics.customDesign = Boolean(design?.enabled);
        const selected = design?.enabled
            ? { background: design.background, layout: cardLayout(design, weatherDesignValues(data, copy)) }
            : layoutWeather(data, copy);

        if (!selected.background) { throw new Error("请先上传背景"); }

        if (selected.layout.overflow.length) { throw new Error("文字超出区域，请调整字号或区域大小"); }

        stage = "images_request";
        const stream = await renderLayers(urls(ASSET_PREFIX, "cards/assets/"), selected.background, selected.layout, signal, backgrounds, "jpeg");

        check();
        stage = "image_save";
        await ctx.r2.put(path, stream, { contentType: "image/jpeg" });
        diagnostics.imageSaved = true;

        check();
        return { url, diagnostics: { ...diagnostics } };
    };

    try {
        return await Promise.race([prepare(), new Promise<never>((_, reject) => {
            timer = setTimeout(() => { expired = true; reject(new DOMException("天气图片准备超时", "TimeoutError")); }, 10_000);
        })]);
    } catch (error) {
        throw new CardImageError(stage, error, { ...diagnostics, ...errorDetails(error) });
    } finally {
        if (timer !== undefined) { clearTimeout(timer); }
    }
}
async function readImage({ ctx, params }: RouteInput) {
    const { day = "", file = "" } = params, today = dateAt(Date.now());

    if (!validDate(day) || day < addDays(today, -1) || day > today || !/^(?:[A-Za-z0-9_.!~*'()-]|%[0-9A-F]{2})+-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/.test(file)) {
        return new Response(null, { status: 404 });
    }

    const stream = await ctx.r2.getStream(`${PREFIX}${day}/${file}`);
    return stream ? new Response(stream, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=3600", "x-content-type-options": "nosniff" } }) : new Response(null, { status: 404 });
}
export const weatherCardRoutes: Route[] = [{ method: "GET", path: "/weather/cards/:day/:file", auth: "public", handler: readImage }];
export async function cleanupWeatherImages(ctx: Ctx, now: number) {
    const cutoff = dateAt(now);
    return cleanupDatedObjects(ctx.r2, PREFIX, cutoff);
}
