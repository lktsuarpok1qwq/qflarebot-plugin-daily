import type { Ctx } from "./types.js";
import { validDate } from "./date.js";
/** Dedicated prefix containing only YYYY-MM-DD/... keys; the caller owns retention policy. */
export async function cleanupDatedObjects(r2: Pick<Ctx["r2"], "list" | "delete">, prefix: string, before: string) {
    if (!prefix || !prefix.endsWith("/") || !validDate(before)) { throw new Error("资源清理范围无效"); }

    for (; ;) {
        const objects = await r2.list(prefix, { limit: 1000 });
        const expired: string[] = [];

        for (const object of objects) {
            const relative = object.key.slice(prefix.length);

            if (!object.key.startsWith(prefix) || !/^\d{4}-\d{2}-\d{2}\//.test(relative)) { throw new Error("资源目录包含非日期路径"); }

            if (relative.slice(0, 10) < before) { expired.push(object.key); }
        }

        if (expired.length) { await r2.delete(expired); }

        // SDK fills the limit across R2 pages; ordered keys allow stopping at the first retained date.
        if (objects.length < 1000 || expired.length < objects.length) { return; }
    }
}
