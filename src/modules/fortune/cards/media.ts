import { cleanupDatedObjects } from "../../../shared/dated-objects.js";
import { backgrounds } from "./backgrounds/index.js";
import { ASSET_PREFIX, type CardState } from "../../../shared/cards/types.js";
import { CardImageError, renderLayers } from "../../../shared/cards/render.js";
import { cardLayout } from "../../../shared/cards/layout.js";
import { fortuneDesignValues } from "./design.js";
import type { Route, RouteInput } from "@qqbot/sdk";
import type { Ctx } from "../../../shared/types.js";
import { addDays, dateAt, validDate } from "../../../shared/date.js";
import { layoutFortune } from "./default.js";
import type { CardRow, CardSnapshot } from "./store.js";
import { imageUrls } from "../../../shared/public-origin.js";
import { errorDetails, type Diagnostics } from "../../../shared/diagnostics.js";

const PREFIX = "fortune/cards/";
const key = (day: string, file: string) => `${PREFIX}${day}/${file}`;
type ImageStage = "public_address" | "cache_check" | "snapshot_parse" | "layout" | "images_request" | "image_save";

export async function cardImage(ctx: Ctx, userId: string, row: CardRow, view: "small" | "detail", state?: CardState, fresh?: CardSnapshot) {
    const deadline = Date.now() + 10_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expired = false;
    let stage: ImageStage = "public_address";
    const diagnostics: Diagnostics = { view, imageFormat: "png", imageCache: "unknown", snapshotSource: fresh ? "new" : "stored", imageSaved: false };
    const check = () => {
        if (expired || Date.now() >= deadline) { throw new DOMException("运势图片准备超时", "TimeoutError"); }
    };
    const prepare = async () => {
        const design = state?.config[view];
        const custom = design?.enabled ? design : null;
        const imageView = `${view}-i${custom ? 1 : 2}-r${custom ? state!.revision : 0}`;
        const file = `${encodeURIComponent(userId)}-${row.token}-${imageView}.png`;
        const path = key(row.day, file);
        diagnostics.imageKey = path;
        diagnostics.customDesign = Boolean(custom);
        const urls = await imageUrls(ctx);
        const url = urls(path);
        diagnostics.imageHost = new URL(url).hostname;
        stage = "cache_check";
        // 认领成功后生成新令牌；只有已有快照才可能命中图片缓存
        const existing = fresh ? null : await ctx.r2.head(path);
        diagnostics.imageCache = existing ? "hit" : "miss";
        diagnostics.imageSaved = Boolean(existing);
        check();

        if (!existing) {
            stage = "snapshot_parse";
            const snapshot = fresh ?? JSON.parse(row.snapshot) as CardSnapshot;

            const signal = AbortSignal.timeout(Math.max(1, deadline - Date.now()));
            stage = "layout";
            const selected = custom ? { background: custom.background, layout: cardLayout(custom, fortuneDesignValues(snapshot)) } : layoutFortune(snapshot, view);

            if (!selected.background) { throw new Error("请先上传背景"); }

            if (selected.layout.overflow.length) { throw new Error("文字超出区域，请调整字号或区域大小"); }

            stage = "images_request";
            const stream = await renderLayers(urls(ASSET_PREFIX, "cards/assets/"), selected.background, selected.layout, signal, backgrounds);

            check();
            stage = "image_save";
            await ctx.r2.put(path, stream, { contentType: "image/png" });
            diagnostics.imageSaved = true;
            check();
        }

        return { url, cache: existing ? "hit" : "miss", diagnostics: { ...diagnostics } };
    };

    try {
        return await Promise.race([prepare(), new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
                expired = true;
                reject(new DOMException("运势图片准备超时", "TimeoutError"));
            }, 10_000);
        })]);
    } catch (error) {
        throw new CardImageError(stage, error, { ...diagnostics, ...errorDetails(error) });
    } finally {
        if (timer !== undefined) { clearTimeout(timer); }
    }
}

async function readImage({ ctx, params }: RouteInput) {
    const { day = "", file = "" } = params, today = dateAt(Date.now());

    if (!validDate(day) || day < addDays(today, -1) || day > today || !/^(?:[A-Za-z0-9_.!~*'()-]|%[0-9A-F]{2})+-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-(small|detail)-i[1-9][0-9]{0,2}-r[0-9]{1,10}\.png$/.test(file)) {
        return new Response(null, { status: 404 });
    }

    let stream;

    try {
        stream = await ctx.r2.getStream(key(day, file));
    } catch (error) {
        ctx.logger.warn("运势图片读取失败", { stage: "image_read", imageKey: key(day, file), ...errorDetails(error) });
        throw error;
    }

    if (!stream) { ctx.logger.warn("运势图片不存在", { stage: "image_read", imageKey: key(day, file), status: 404 }); }

    return stream ? new Response(stream, { headers: { "content-type": "image/png", "cache-control": "public, max-age=3600", "x-content-type-options": "nosniff" } }) : new Response(null, { status: 404 });
}

export const cardRoutes: Route[] = [{ method: "GET", path: "/fortune/cards/:day/:file", auth: "public", handler: readImage }];

export async function cleanupCardImages(ctx: Ctx, now: number) {
    return cleanupDatedObjects(ctx.r2, PREFIX, dateAt(now));
}
