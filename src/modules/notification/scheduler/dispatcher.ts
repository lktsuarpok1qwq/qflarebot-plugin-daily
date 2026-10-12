import type { Ctx, Rendered } from "../../../shared/types.js";
import type { DeliveryStatus, Due } from "../types.js";
import { LIMITS } from "../types.js";
import { snapshot } from "../data/repository.js";
import { claimMany, deliveryKey, due, finishMany, type Claim, type Outcome } from "../data/deliveries.js";
import { message } from "../../../shared/message.js";
import { renderMessage } from "../content/renderer.js";
import type { VariableAPI } from "../../../shared/variables.js";
import { nextPlan } from "./planner.js";
import { resultStatus } from "./result.js";

export async function dispatch(ctx: Ctx, variables: VariableAPI, clock = Date.now): Promise<void> {
    await dispatchPass(ctx, variables, clock, true);
}
async function dispatchPass(ctx: Ctx, variables: VariableAPI, clock: () => number, catchUp: boolean): Promise<void> {
    const rows = await due(ctx.db, clock());

    if (!rows.length) {
        return;
    }

    const s = await snapshot(ctx.db);
    const tasks = new Map(s.config.tasks.map((t) => [t.id, t]));
    const recipients = new Map(s.config.recipients.map((r) => [r.id, r]));
    const bindings = new Map(s.config.bindings.map((b) => [`${b.taskId}:${b.recipientId}`, b]));
    const resolve = variables.resolve(ctx);
    const rendered = new Map<string, Promise<Rendered>>();
    const claims: Claim[] = [],
        texts = new Map<string, Rendered>(),
        outcomes: Outcome[] = [];
    const next = (d: Due) => {
        const task = tasks.get(d.task_id);
        return task
            ? nextPlan(
                task.schedule,
                Math.max(
                    d.due_at,
                    clock() >= d.due_at + 60_000 ? Math.floor(clock() / 60_000) * 60_000 - 1 : clock(),
                ),
            )
            : null;
    };

    for (const d of rows) {
        if (d.status) {
            if (
                d.status === "sending" &&
                clock() < Math.max(d.due_at + 60_000, (d.claimed_at ?? d.due_at) + LIMITS.requestBudgetMs) + 5_000
            ) {
                continue;
            }

            outcomes.push({
                d,
                status: d.status === "sending" ? "uncertain" : (d.status as DeliveryStatus),
                now: clock(),
                next: next(d),
                error: d.status === "sending" ? "interrupted_after_claim" : null,
            });
            continue;
        }

        const t = tasks.get(d.task_id),
            r = recipients.get(d.recipient_id),
            b = bindings.get(d.id);
        let status: DeliveryStatus = "sending",
            error: string | null = null,
            details: unknown = {};

        if (
            !t ||
            !r ||
            !b ||
            !t.enabled ||
            !r.enabled ||
            s.config.paused ||
            s.botId !== ctx.botId ||
            r.botId !== ctx.botId
        ) {
            status = "skipped_disabled";
        } else if (clock() >= d.due_at + 60_000) {
            status = "skipped_expired";
        } else if (clock() >= d.due_at + 60_000 - LIMITS.reserveMs) {
            status = "skipped_budget";
            error = "sdk_budget_reserve";
        } else {
            try {
                const key = JSON.stringify([t.templateId, d.due_at]);
                let value = rendered.get(key);

                if (!value) {
                    value = renderMessage(t, s.config, d.due_at, resolve, variables.keys);
                    rendered.set(key, value);
                }

                const result = await value;
                texts.set(deliveryKey(d), result);
                details = result;

                if (!result.text) {
                    status = "skipped_empty";
                }
            } catch (e) {
                status = "failed_validation";
                error = e instanceof Error ? e.message : "render_failed";
            }
        }

        claims.push({
            d,
            status,
            now: clock(),
            details: {
                ...(details as object),
                reason: status === "skipped_empty" ? "empty_message" : status,
            },
            error,
        });
    }

    const owned = await claimMany(ctx.db, claims, s.revision);
    const pending = claims.filter((c) => owned.has(deliveryKey(c.d)));
    const fresh = pending.some((item) => item.status === "sending")
        ? await ctx.db.first<{ revision: number }>("SELECT revision FROM {notification_state} WHERE id=1")
        : null;
    await Promise.all(
        pending.map(async ({ d, status, error }) => {
            const outcome: Outcome = { d, status, error, now: clock(), next: null };

            try {
                if (outcome.status === "sending") {
                    if (fresh?.revision !== s.revision) {
                        outcome.status = "skipped_disabled";
                    } else if (clock() >= d.due_at + 60_000 - LIMITS.reserveMs) {
                        outcome.status = "skipped_budget";
                        outcome.error = "sdk_budget_reserve";
                    } else {
                        const r = recipients.get(d.recipient_id)!;
                        Object.assign(
                            outcome,
                            resultStatus(
                                await ctx.api.sendMessage(
                                    { scene: r.scene, id: r.openid },
                                    message(texts.get(deliveryKey(d))!.text),
                                ),
                            ),
                        );
                    }
                }
            } catch (e) {
                outcome.status = "uncertain";
                outcome.error = e instanceof Error ? e.message.slice(0, 300) : "send_failed";
            }

            outcome.now = clock();
            outcome.next = next(d);
            outcomes.push(outcome);
        }),
    );

    try {
        await finishMany(ctx.db, outcomes);
    } catch (e) {
        // Never resend after result persistence failed; a later cron recovers the claim.
        ctx.logger.error("每日结果保存失败，等待中断收敛", { error: String(e) });
        return;
    }

    // One catch-up pass can reach today's live window after advancing expired cursors.
    if (
        catchUp &&
        outcomes.some((o) => o.next && o.next.due <= clock() && clock() < o.next.due + 60_000 - LIMITS.reserveMs)
    ) {
        await dispatchPass(ctx, variables, clock, false);
    }
}
