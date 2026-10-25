import type { Ctx } from "../../../shared/types.js";
import { dateAt } from "../../../shared/date.js";
import { SCHEMA_VERSION, RETENTION_DAYS } from "../types.js";

export async function maintenance(ctx: Ctx, scheduledAt: number, manual = false) {
    const day = dateAt(scheduledAt);

    if (!manual) {
        const claim = await ctx.db.run(
            "INSERT INTO {maintenance}(job,day,error) VALUES ('cleanup',?,NULL) ON CONFLICT(job) DO UPDATE SET day=excluded.day,error=excluded.error WHERE day<excluded.day",
            day,
        );

        if (!claim.changes) {
            return { ok: true, message: "今天已执行维护" };
        }
    }

    let error: string | null = null;

    try {
        const row = await ctx.db.first<{ retentionDays: number }>("SELECT json_extract(config,'$.retentionDays') AS retentionDays FROM {notification_state} WHERE id=1 AND json_extract(config,'$.schemaVersion')=?", SCHEMA_VERSION);

        if (!row || !RETENTION_DAYS.includes(row.retentionDays)) { throw new Error("通知保留天数配置无效"); }

        await ctx.db.run(
            "DELETE FROM {deliveries} WHERE key IN (SELECT key FROM {deliveries} WHERE updated_at<? AND status<>'sending' ORDER BY updated_at LIMIT 1000)",
            scheduledAt - row.retentionDays * 86_400_000,
        );
    } catch (e) {
        error = e instanceof Error ? e.message.slice(0, 200) : "cleanup_failed";
    }

    if (manual || error !== null) {
        await ctx.db.run(
            "INSERT INTO {maintenance}(job,day,error) VALUES ('cleanup',?,?) ON CONFLICT(job) DO UPDATE SET day=excluded.day,error=excluded.error WHERE day<excluded.day OR (day=excluded.day AND error IS NOT excluded.error)",
            day,
            error,
        );
    }

    return { ok: !error, message: error ? `维护失败：${error}` : "清理完成" };
}
