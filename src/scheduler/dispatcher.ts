import type { Ctx, DeliveryStatus, Due, Rendered } from "../types.js";
import { LIMITS } from "../types.js";
import { progress, readData } from "../data/repository.js";
import {
  claimMany,
  deliveryKey,
  due,
  finishMany,
  type Claim,
  type Outcome,
} from "../data/deliveries.js";
import { renderMessage } from "../content/renderer.js";
import { holidayService } from "../content/holiday.js";
import { nextPlan } from "./planner.js";
import { eventKeys } from "./events.js";
import { resultStatus } from "./result.js";

export async function dispatch(ctx: Ctx, clock = Date.now): Promise<void> {
  await dispatchPass(ctx, clock, LIMITS.batch, true);
}
async function dispatchPass(
  ctx: Ctx,
  clock: () => number,
  remaining: number,
  catchUp: boolean,
): Promise<void> {
  const rows = await due(ctx.db, clock());
  if (!rows.length) return;
  const [{ snapshot: s, sources: raw }, done] = await Promise.all([
    readData(ctx.db),
    progress(ctx.db, [
      ...new Set(rows.filter((d) => d.event_key).map((d) => d.id)),
    ]),
  ]);
  const tasks = new Map(s.config.tasks.map((t) => [t.id, t]));
  const recipients = new Map(s.config.recipients.map((r) => [r.id, r]));
  const bindings = new Map(
    s.config.bindings.map((b) => [`${b.taskId}:${b.recipientId}`, b]),
  );
  const service = holidayService(s.config, raw);
  const rendered = new Map<string, Promise<Rendered>>();
  const claims: Claim[] = [],
    texts = new Map<string, string>(),
    outcomes: Outcome[] = [];
  const next = (d: Due) => {
    const task = tasks.get(d.task_id),
      handled = new Set(done.get(d.id));
    for (const key of eventKeys(d.event_key)) handled.add(key);
    return task
      ? nextPlan(
          task.schedule,
          Math.max(
            d.due_at,
            clock() >= d.due_at + 60_000
              ? Math.floor(clock() / 60_000) * 60_000 - 1
              : clock(),
          ),
          s.config,
          handled,
        )
      : null;
  };
  let admitted = 0,
    eventRecoveries = 0,
    started = 0;
  for (const d of rows) {
    if (d.status) {
      if (
        d.event_key &&
        ["sending", "success", "uncertain"].includes(d.status) &&
        ++eventRecoveries > LIMITS.batch
      )
        continue;
      if (
        d.status === "sending" &&
        clock() <
          Math.max(
            d.due_at + 60_000,
            (d.claimed_at ?? d.due_at) + LIMITS.requestBudgetMs,
          ) +
            5_000
      )
        continue;
      outcomes.push({
        d,
        status:
          d.status === "sending" ? "uncertain" : (d.status as DeliveryStatus),
        now: clock(),
        next: next(d),
        error: d.status === "sending" ? "interrupted_after_claim" : null,
      });
      continue;
    }
    if (d.revision !== s.revision) continue;
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
      !b.enabled ||
      s.config.paused ||
      s.botId !== ctx.botId ||
      r.botId !== ctx.botId
    )
      status = "skipped_disabled";
    else if (clock() >= d.due_at + 60_000) status = "skipped_expired";
    else if (
      d.event_key &&
      eventKeys(d.event_key).every((key) => done.get(d.id)?.has(key))
    ) {
      status = "skipped_duplicate";
      error = "event_already_handled";
    } else if (clock() >= d.due_at + 60_000 - LIMITS.reserveMs) {
      status = "skipped_budget";
      error = "sdk_budget_reserve";
    } else {
      try {
        const activeEvents = eventKeys(d.event_key).filter(
          (key) => !done.get(d.id)?.has(key),
        );
        if (activeEvents.some((key) => !service.isVerified(key.split(":")[0]!)))
          throw new Error("假期区间与放假/补班数据冲突");
        const key = JSON.stringify([
          t.id,
          d.due_at,
          b.overrideText,
          activeEvents,
        ]);
        let value = rendered.get(key);
        if (!value) {
          value = renderMessage(
            t,
            b,
            s.config,
            d.due_at,
            raw,
            service,
            activeEvents,
          );
          rendered.set(key, value);
        }
        const result = await value;
        texts.set(deliveryKey(d), result.text);
        details = { items: result.items, text: result.text };
        if (!result.text) status = "skipped_empty";
      } catch (e) {
        status = "failed_validation";
        error = e instanceof Error ? e.message : "render_failed";
      }
    }
    if (status === "sending" && ++admitted > remaining) {
      status = "skipped_budget";
      error = "minute_capacity_exceeded";
    }
    claims.push({
      d,
      status,
      now: clock(),
      details: {
        ...(details as object),
        reason:
          status === "skipped_empty" ? "all_contents_inapplicable" : status,
      },
      error,
    });
  }
  const owned = await claimMany(ctx.db, claims);
  const pending = claims.filter((c) => owned.has(deliveryKey(c.d)));
  let index = 0;
  async function worker() {
    for (;;) {
      const item = pending[index++];
      if (!item) return;
      const { d } = item;
      const outcome: Outcome = {
        d,
        status: item.status,
        now: clock(),
        next: null,
        error: item.error,
      };
      try {
        if (outcome.status === "sending") {
          const fresh = await ctx.db.first<{ revision: number }>(
            "SELECT revision FROM {state} WHERE id=1",
          );
          if (fresh?.revision !== d.revision)
            outcome.status = "skipped_disabled";
          else if (clock() >= d.due_at + 60_000 - LIMITS.reserveMs) {
            outcome.status = "skipped_budget";
            outcome.error = "sdk_budget_reserve";
          } else {
            const r = recipients.get(d.recipient_id)!;
            started++;
            Object.assign(
              outcome,
              resultStatus(
                await ctx.api.sendMessage(
                  { scene: r.scene, id: r.openid },
                  { text: texts.get(deliveryKey(d))! },
                ),
              ),
            );
          }
        }
      } catch (e) {
        outcome.status = "uncertain";
        outcome.error =
          e instanceof Error ? e.message.slice(0, 300) : "send_failed";
      }
      outcome.now = clock();
      outcome.next = next(d);
      outcomes.push(outcome);
    }
  }
  await Promise.all(Array.from({ length: LIMITS.concurrency }, () => worker()));
  try {
    await finishMany(ctx.db, outcomes);
  } catch (e) {
    // Never resend after result persistence failed; a later cron recovers the claim.
    ctx.logger.error("每日结果保存失败，等待中断收敛", { error: String(e) });
    return;
  }
  // At most one second pass, sharing the original send cap. Only today's still
  // valid window is eligible after an outage; expired windows are not replayed.
  if (
    catchUp &&
    remaining > started &&
    outcomes.some(
      (o) =>
        o.next &&
        o.next.due <= clock() &&
        clock() < o.next.due + 60_000 - LIMITS.reserveMs,
    )
  )
    await dispatchPass(ctx, clock, remaining - started, false);
}
