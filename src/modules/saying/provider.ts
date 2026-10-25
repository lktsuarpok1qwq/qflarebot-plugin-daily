import { readJson } from "../../shared/json.js";
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

    try {
        const data = await readJson(response);

        if (!data || typeof data !== "object" || Array.isArray(data) || !("text" in data)) {
            throw new Error("一言响应格式错误");
        }

        str(data.text, Infinity, "一言内容");

        return data.text.trim();
    } catch {
        throw new Error("一言响应无效或读取超时");
    }
}
