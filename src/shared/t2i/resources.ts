import { unzlibSync } from "fflate";
import { fromBase64, inflateBackground } from "./encoding.js";
import { createFonts } from "./fonts.js";
import { unsupported } from "./errors.js";
import type { IconName } from "./types.js";

import type { T2IAssets, BackgroundSource, SpriteSource, EncodedPixels, RowPNGInfo } from "./asset-types.js";

function variant(source: SpriteSource, size?: number): EncodedPixels {
    return size !== undefined && source.variants && Object.hasOwn(source.variants, String(size)) ? source.variants[String(size)]! : source;
}

export interface Pixels {
    width: number;
    height: number;
    data: Uint8Array;
}


// 仅缓存静态背景字节；4 MiB 可容纳多张常用卡面，不随资源库扩大而全量常驻
const backgroundCacheBytes = 4 * 1024 * 1024;
export function createResources(assets: T2IAssets) {
    const backgrounds = new Map<BackgroundSource, { encoded: string; data: Uint8Array }>();
    let cachedBytes = 0;
    const { backgrounds: backgroundData, emoji: emojiData, icons: iconData } = assets;
    function backgroundInfo(id: string) {
        if (!Object.hasOwn(backgroundData, id)) {
            unsupported("未找到内置背景");
        }

        return backgroundData[id]!;
    }

    function listBackgrounds() {
        return Object.entries(backgroundData).map(([id, { width, height, description, regions }]) => ({ id, width, height, description, ...(regions ? { regions: Object.fromEntries(Object.entries(regions).map(([key, value]) => [key, { ...value }])) } : {}) }));
    }

    function hasEmoji(id: string): boolean {
        return Object.hasOwn(emojiData, id);
    }

    function decode(data: { width: number; height: number; data: string }): Pixels {
        const pixels = unzlibSync(fromBase64(data.data));

        if (pixels.length !== data.width * data.height * 4) {
            throw new Error("内置素材数据损坏");
        }

        return { width: data.width, height: data.height, data: pixels };
    }

    async function getBackground(id: string): Promise<Pixels & { info: RowPNGInfo }> {
        const source = backgroundInfo(id);
        let cached = backgrounds.get(source);

        if (cached) {
            backgrounds.delete(source);
            cachedBytes -= cached.data.length;

            if (cached.encoded !== source.data) { cached = undefined; }
        }

        const data = cached?.data ?? await inflateBackground(source);
        const { info } = source;

        if (data.length !== source.bytes || info.width !== source.width || info.height !== source.height
            || (info.channels !== 3 && info.channels !== 4) || info.stride !== source.width * info.channels + 1) {
            throw new Error("背景模板数据损坏");
        }

        if (data.length <= backgroundCacheBytes) {
            while (cachedBytes + data.length > backgroundCacheBytes) {
                const oldest = backgrounds.keys().next().value!;
                cachedBytes -= backgrounds.get(oldest)!.data.length;
                backgrounds.delete(oldest);
            }

            backgrounds.set(source, cached ?? { encoded: source.data, data });
            cachedBytes += data.length;
        }

        return { width: source.width, height: source.height, info, data };
    }

    const icons = new WeakMap<EncodedPixels, Pixels>();
    function getIcon(name: IconName, size?: number): Pixels {
        if (!Object.hasOwn(iconData, name)) {
            unsupported("该图标尚未导入");
        }

        const source = variant(iconData[name]!, size);
        let mask = icons.get(source);

        if (!mask) {
            const data = unzlibSync(fromBase64(source.data));

            if (data.length !== source.width * source.height) {
                throw new Error("图标素材数据损坏");
            }

            mask = { width: source.width, height: source.height, data }; icons.set(source, mask);
        }

        return mask;
    }

    // Emoji 解码由每次渲染的局部 Map 复用，避免全部常驻
    function getEmoji(id: string, size?: number): Pixels {
        if (!hasEmoji(id)) {
            unsupported("暂不支持这个 Emoji");
        }

        return decode(variant(emojiData[id]!, size));
    }
    return { backgroundInfo, listBackgrounds, hasEmoji, getBackground, getIcon, getEmoji, ...createFonts(assets.fonts) };
}
export type RenderResources = ReturnType<typeof createResources>;
