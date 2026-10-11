import { str } from "../../shared/validation.js";
export async function randomSaying(fetcher: typeof fetch = fetch): Promise<string> {
    let response: Response;

    try {
        response = await fetcher("https://uapis.cn/api/v1/saying", { signal: AbortSignal.timeout(8_000), redirect: "manual" });
    } catch {
        throw new Error("一言连接失败或超时");
    }

    if (!response.ok) {
        await response.body?.cancel().catch(() => { });
        throw new Error("一言 HTTP " + response.status);
    }

    const reader = response.body?.getReader();

    if (!reader) {
        throw new Error("一言响应为空");
    }

    let size = 0, raw = "";
    const decoder = new TextDecoder();

    try {
        for (; ;) {
            const { value, done } = await reader.read();

            if (done) {
                break;
            }

            size += value.byteLength;

            if (size > 256_000) {
                throw new Error("一言响应过大");
            }

            raw += decoder.decode(value, { stream: true });
        }

        const data: unknown = JSON.parse(raw + decoder.decode());

        if (!data || typeof data !== "object" || Array.isArray(data) || !("text" in data)) {
            throw new Error("一言响应格式错误");
        }

        str(data.text, Infinity, "一言内容");
        return data.text.trim();
    } catch {
        throw new Error("一言响应无效或读取超时");
    } finally {
        await reader.cancel().catch(() => { });
        reader.releaseLock();
    }
}
