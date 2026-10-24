import type { Ctx } from "./types.js";
import { validDate } from "./date.js";

/** 专用前缀下仅包含 YYYY-MM-DD/... 键；每次最多处理 1000 个对象，保留策略由调用方决定 */
export async function cleanupDatedObjects(r2: Pick<Ctx["r2"], "list" | "delete">, prefix: string, before: string) {
    if (!prefix || !prefix.endsWith("/") || !validDate(before)) { throw new Error("资源清理范围无效"); }

    const objects = await r2.list(prefix, { limit: 1000 });
    const expired: string[] = [];

    for (const object of objects) {
        const relative = object.key.slice(prefix.length);

        if (!object.key.startsWith(prefix) || !/^\d{4}-\d{2}-\d{2}\//.test(relative)) { throw new Error("资源目录包含非日期路径"); }

        if (relative.slice(0, 10) < before) { expired.push(object.key); }
    }

    if (expired.length) { await r2.delete(expired); }
}
