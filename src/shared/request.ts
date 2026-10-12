import { AdminError } from "./admin-errors.js";
import { readJson } from "./json.js";
import { BODY_BYTES } from "./types.js";
export async function body(request: Request, limit = BODY_BYTES + 4096): Promise<Record<string, unknown>> {
    let data: unknown;

    try {
        data = await readJson(request, limit, "请求体");
    } catch (error) {
        throw new AdminError("validation", error instanceof Error ? error.message : "请求体无效");
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new AdminError("validation", "请求体必须为对象");
    }

    return data as Record<string, unknown>;
}
