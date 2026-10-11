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
export async function recordCheck(ctx: Ctx, year: number, error: string | null, now: number, success: boolean) {
    // Check metadata is independent of editable configuration and cannot roll back a newer result.
    await ctx.db.run(
        `INSERT INTO {calendar_sources}(year,hash,data,error,updated_at,checked_at) VALUES(?,'','',?,?,?)
        ON CONFLICT(year) DO UPDATE SET error=excluded.error,checked_at=CASE WHEN ? THEN excluded.checked_at ELSE checked_at END
        WHERE updated_at<=? AND checked_at<=? AND (error IS NOT excluded.error OR (? AND checked_at<>excluded.checked_at))`,
        year, error, now, success ? now : 0, success ? 1 : 0, now, now, success ? 1 : 0,
    );
}
