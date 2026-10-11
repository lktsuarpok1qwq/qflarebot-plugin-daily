import type { Ctx } from "../../types.js";
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
        for (;;) {
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
        await reader.cancel();
    }
}
export async function setError(ctx: Ctx, year: number, error: string, now: number) {
    await ctx.db.run(
        "INSERT INTO {sources}(year,hash,data,error,updated_at) VALUES (?,'','',?,?) ON CONFLICT(year) DO UPDATE SET error=excluded.error WHERE error IS NOT excluded.error",
        year,
        error,
        now,
    );
}

// Store check timestamps in the maintenance table.
export const SOURCE_QUERY =
    "SELECT s.*, CAST(m.day AS INTEGER) AS checked_at FROM {sources} s LEFT JOIN {maintenance} m ON m.job='calendar:' || s.year";
export async function checked(ctx: Ctx, year: number, now: number, error: string | null = null) {
    await ctx.db.batch([
        {
            sql: "INSERT INTO {maintenance}(job,day,error) VALUES (?,?,NULL) ON CONFLICT(job) DO UPDATE SET day=excluded.day WHERE day<>excluded.day",
            params: [`calendar:${year}`, String(now)],
        },
        {
            sql: "UPDATE {sources} SET error=? WHERE year=? AND error IS NOT ?",
            params: [error, year, error],
        },
    ]);
}
