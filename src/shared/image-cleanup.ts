import type { Ctx } from "./types.js";
import { dateAt } from "./date.js";

export type ImageCleanup = { id: string; run: (ctx: Ctx, scheduledAt: number) => Promise<void> };

export function imageCleanupJobs(modules: readonly ImageCleanup[]) {
    return async (ctx: Ctx, scheduledAt: number) => {
        const result = await ctx.db.run(
            "INSERT INTO {maintenance}(job,day,error) VALUES ('image_cleanup:start',?,NULL) ON CONFLICT(job) DO UPDATE SET day=excluded.day WHERE day<excluded.day",
            dateAt(scheduledAt),
        );

        if (!result.changes) { return; }

        const failures: string[] = [];

        for (const module of modules) {
            try {
                await module.run(ctx, scheduledAt);
            } catch (error) {
                failures.push(`${module.id}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        if (failures.length) { throw new Error(`图片清理失败：${failures.join("；")}`); }
    };
}
