import type { BackgroundSource, RowPNGInfo } from "./asset-types.js";

/** 大型区域索引只在卡面首次绘制时解析 */
export function lazyBackground(source: Omit<BackgroundSource, "info">, encodedInfo: string): BackgroundSource {
    let info: RowPNGInfo | undefined;
    return { ...source, get info() { return info ??= JSON.parse(encodedInfo) as RowPNGInfo; } };
}

export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
    const bytes = Uint8Array as typeof Uint8Array & { fromBase64?: (value: string) => Uint8Array<ArrayBuffer> };

    if (typeof bytes.fromBase64 === "function") {
        return bytes.fromBase64(value);
    }

    const text = atob(value);
    const data = new Uint8Array(text.length);

    for (let i = 0; i < text.length; i++) {
        data[i] = text.charCodeAt(i);
    }

    return data;
}

/** 只还原所选 PNG；直接写入已知大小的缓冲，避免 Blob/Response 和拼接副本 */
export async function inflateBackground(source: Pick<BackgroundSource, "data" | "bytes">): Promise<Uint8Array> {
    const data = new Uint8Array(source.bytes);
    const stream = new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(fromBase64(source.data)); controller.close(); }
    }).pipeThrough(new DecompressionStream("deflate"));
    const reader = stream.getReader();
    let offset = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) { break; }

            if (offset + value.length > data.length) { throw new Error("背景模板数据损坏"); }

            data.set(value, offset);
            offset += value.length;
        }
    } catch (error) {
        await reader.cancel().catch(() => { });
        throw error;
    } finally { reader.releaseLock(); }

    if (offset !== data.length) { throw new Error("背景模板数据损坏"); }

    return data;
}
