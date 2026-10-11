export async function readJson(input: Request | Response, maxBytes = 256_000, label = "响应"): Promise<unknown> {
    if (Number(input.headers.get("content-length") ?? 0) > maxBytes) {
        await input.body?.cancel().catch(() => { });
        throw new Error(label + "过大");
    }

    const reader = input.body?.getReader();

    if (!reader) { throw new Error(label + "为空"); }

    let size = 0, text = "";
    const decoder = new TextDecoder();

    try {
        for (; ;) {
            const { value, done } = await reader.read();

            if (done) { break; }

            size += value.byteLength;

            if (size > maxBytes) { throw new Error(label + "过大"); }

            text += decoder.decode(value, { stream: true });
        }

        return JSON.parse(text + decoder.decode()) as unknown;
    } finally {
        await reader.cancel().catch(() => { });
        reader.releaseLock();
    }
}
