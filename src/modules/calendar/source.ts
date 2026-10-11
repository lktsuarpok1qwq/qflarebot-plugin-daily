import { readData, saveConfig } from "./repository.js";
import type { Source } from "./types.js";
import type { Ctx } from "../../shared/types.js";

export type SyncResult = {
    year: number;
    status: "updated" | "cached" | "not_published" | "error" | "skipped";
    error?: string;
};
export async function hash(text: string) {
    return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), (x) =>
        x.toString(16).padStart(2, "0"),
    ).join("");
}
export async function limitedJson(res: Response, maxBytes = 256_000) {
    if (!res.body) {
        throw new Error("假期源为空");
    }

    const reader = res.body.getReader();
    let size = 0,
        text = "";
    const decoder = new TextDecoder();

    try {
        for (; ;) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            size += value.byteLength;

            if (size > maxBytes) {
                throw new Error("假期源过大");
            }

            text += decoder.decode(value, { stream: true });
        }

        text += decoder.decode();
        return JSON.parse(text);
    } finally {
        await reader.cancel().catch(() => { });
        reader.releaseLock();
    }
}
export async function recordCheck(ctx: Ctx, year: number, error: string | null, now: number, success: boolean) {
    const { snapshot, sources } = await readData(ctx.db);
    const previous = sources.find((s) => s.year === year);
    const source: Source = previous
        ? { ...previous, error }
        : { year, hash: "", data: "", error, updated_at: now, checked_at: 0 };

    if (success) {
        source.checked_at = now;
    }

    if (JSON.stringify(source) !== JSON.stringify(previous)) {
        await saveConfig(ctx, snapshot, snapshot.config, now, source);
    }
}
