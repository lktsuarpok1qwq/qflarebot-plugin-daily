import type { Ctx } from "./types.js";
import { dateAt } from "./date.js";
export type ImageCleanup = { id: string; run: (ctx: Ctx, scheduledAt: number) => Promise<boolean> };
const START = "image_cleanup:start", PREFIX = "image_cleanup:pending:";
export function imageCleanupJobs(modules: readonly ImageCleanup[]) {
    const jobs = modules.map(module => PREFIX + module.id);
    const placeholders = jobs.map(() => "?").join(",");
    const byJob = new Map(modules.map(module => [PREFIX + module.id, module]));
    async function execute(ctx: Ctx, scheduledAt: number, pending: { job: string; epoch: string }[]) {
        const failures: string[] = [];

        for (const item of pending) {
            const module = byJob.get(item.job)!;

            try {
                const more = await module.run(ctx, scheduledAt);

                if (more) {
                    const next = new Date((Math.floor(Math.max(scheduledAt, Date.now()) / 60_000) + 1) * 60_000).toISOString();
                    await ctx.db.run(
                        "INSERT INTO {maintenance}(job,day,error) SELECT ?,?,NULL WHERE EXISTS (SELECT 1 FROM {maintenance} WHERE job=? AND day=?) ON CONFLICT(job) DO NOTHING",
                        item.job, next, START, item.epoch,
                    );
                }
            } catch (error) {
                failures.push(`${module.id}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        if (failures.length) { throw new Error(`图片清理失败：${failures.join("；")}`); }
    }
    return {
        async daily(ctx: Ctx, scheduledAt: number) {
            const day = dateAt(scheduledAt);
            const result = await ctx.db.batch<{ day: string }>([
                { sql: `DELETE FROM {maintenance} WHERE job IN (${placeholders}) AND NOT EXISTS (SELECT 1 FROM {maintenance} WHERE job=? AND day>=?)`, params: [...jobs, START, day] },
                { sql: "INSERT INTO {maintenance}(job,day,error) VALUES (?,?,NULL) ON CONFLICT(job) DO UPDATE SET day=excluded.day WHERE day<excluded.day RETURNING day", params: [START, day] },
            ]);

            if (!result[1].results.length) { return; }

            await execute(ctx, scheduledAt, jobs.map(job => ({ job, epoch: day })));
        },
        async resume(ctx: Ctx, scheduledAt: number) {
            const time = new Date(scheduledAt);

            // The daily invocation owns this minute, including any pending work.
            if (time.getUTCHours() === 16 && time.getUTCMinutes() === 10) { return; }

            const pending = await ctx.db.all<{ job: string; epoch: string }>(
                `DELETE FROM {maintenance} WHERE job IN (${placeholders}) AND day<=? RETURNING job,(SELECT day FROM {maintenance} WHERE job=?) AS epoch`,
                ...jobs, time.toISOString(), START,
            );
            await execute(ctx, scheduledAt, pending);
        },
    };
}
