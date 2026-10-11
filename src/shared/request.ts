import { BODY_BYTES } from "./types.js";
export async function body(request: Request, limit = BODY_BYTES + 4096): Promise<Record<string, unknown>> {
    if (Number(request.headers.get("content-length") ?? 0) > limit) {
        throw new Error("请求体过大");
    }

    const reader = request.body?.getReader();

    if (!reader) {
        throw new Error("缺少请求体");
    }

    const chunks: Uint8Array[] = [];
    let size = 0;

    try {
        for (; ;) {
            const { value, done } = await reader.read();

            if (done) {
                break;
            }

            size += value.byteLength;

            if (size > limit) {
                throw new Error("请求体过大");
            }

            chunks.push(value);
        }
    } finally {
        await reader.cancel().catch(() => { });
        reader.releaseLock();
    }

    const bytes = new Uint8Array(size);
    let pos = 0;

    for (const chunk of chunks) {
        bytes.set(chunk, pos);
        pos += chunk.length;
    }

    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("请求体必须为对象");
    }

    return data as Record<string, unknown>;
}
