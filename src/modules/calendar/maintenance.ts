import type { Ctx } from "../../shared/types.js";
import { dateAt } from "../../shared/date.js";
import { refreshCalendar } from "./repository.js";
import { syncYear } from "./sync.js";
import { claimJob, type SyncResult } from "./source.js";

export async function maintenance(
    ctx: Ctx,
    job: "sync" | "cleanup",
    scheduledAt: number,
    manual = false,
    yearOffset?: 0 | 1,
) {
    const day = dateAt(scheduledAt);
    const results: SyncResult[] = [];
    const jobKey = job === "sync" && yearOffset !== undefined ? `sync:${yearOffset}` : job;

    if (!manual && job === "cleanup" && !await claimJob(ctx, jobKey, day)) {
        return { ok: true, message: "今天已执行维护", results };
    }

    try {
        // 数据源变化时在发布阶段重建日历；数据未变时，只有每日清理
        // 和手动刷新需要重建缓存
        if (job === "sync") {
            const year = +day.slice(0, 4);

            for (const y of yearOffset === undefined ? [year, year + 1] : [year + yearOffset]) {
                if (y >= 2000 && y <= 2199) {
                    results.push(await syncYear(ctx, y, fetch, scheduledAt, manual));
                }
            }

            // 获取数据后再刷新，避免损坏的缓存阻止替换
            if (manual) {
                await refreshCalendar(ctx, scheduledAt);
            }
        } else {
            await refreshCalendar(ctx, scheduledAt);
        }

        const labels = {
            updated: "已更新",
            skipped: "无需更新",
            cached: "已有最新数据",
            not_published: "接口暂未提供安排",
            error: "同步失败",
        };
        const describe = (r: SyncResult) => `${r.year} 假期数据：${labels[r.status]}${r.error ? `（${r.error}）` : ""}`;
        const failures = results.filter((r) => r.status === "error").map(describe);
        const error = failures.length ? failures.join("；") : null;

        if (manual || error !== null) {
            await ctx.db.run(
                "INSERT INTO {calendar_jobs}(job,day,error) VALUES (?,?,?) ON CONFLICT(job) DO UPDATE SET day=excluded.day,error=excluded.error WHERE day<excluded.day OR (day=excluded.day AND error IS NOT excluded.error)",
                jobKey,
                day,
                error,
            );
        }

        return {
            ok: !error,
            message: job === "cleanup" ? "清理完成" : results.map(describe).join("；"),
            results,
        };
    } catch (e) {
        await ctx.db.run(
            "INSERT INTO {calendar_jobs}(job,day,error) VALUES (?,?,?) ON CONFLICT(job) DO UPDATE SET day=excluded.day,error=excluded.error WHERE day<excluded.day OR (day=excluded.day AND error IS NOT excluded.error)",
            jobKey,
            day,
            e instanceof Error ? e.message.slice(0, 200) : "maintenance_failed",
        );

        return {
            ok: false,
            message: `维护失败：${e instanceof Error ? e.message : String(e)}`,
            results,
        };
    }
}
