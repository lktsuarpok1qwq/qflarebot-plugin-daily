import { readJson } from "./json.js";
import { BODY_BYTES } from "./types.js";
export async function body(request: Request, limit = BODY_BYTES + 4096): Promise<Record<string, unknown>> {
    const data = await readJson(request, limit, "请求体");

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("请求体必须为对象");
    }

    return data as Record<string, unknown>;
}
