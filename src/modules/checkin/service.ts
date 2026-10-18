import type { PointsService, OperationLookup } from "qflarebot-plugin-points";
import type { Ctx } from "../../shared/types.js";
import { dateAt } from "../../shared/date.js";
import { expand } from "../../shared/interpolation.js";
import type { CheckinCopyKey } from "./copy.js";
import { claim, current, find, finish, snapshot, type Claim } from "./repository.js";
export const SOURCE = "daily";
export function wallet(ctx: Ctx) {
    let service: PointsService;

    try { service = ctx.service<PointsService>("points.wallet"); } catch { return undefined; }

    if (![service.checkAccounts, service.getSourcePolicy, service.registerSource, service.credit, service.getOperation].every(method => typeof method === "function")) {
        throw new Error("积分服务契约不完整，请更新 Points 插件");
    }

    return service;
}
export async function checkin(ctx: Ctx, userId: string, args: readonly string[], clock = Date.now) {
    const day = dateAt(clock());
    const { config, record } = args.length || !userId?.trim() || !ctx.botId?.trim()
        ? { ...await snapshot(ctx.db), record: null }
        : await current(ctx.db, ctx.botId, userId, day);
    const render = (key: CheckinCopyKey, message = "", amount = config.rewardPoints) => ({ text: expand(config.copy[key], { date: day, amount: String(amount), message }) });
    const completed = (saved: Claim, repeated = false) => render(repeated ? "already" : "success", "", saved.amount / 100);

    if (args.length) { return render("usage"); }

    if (!userId?.trim() || !ctx.botId?.trim()) { return render("identity"); }

    let row = record;

    if (row?.status === "committed") { return completed(row, true); }

    let points: PointsService | undefined;

    try { points = wallet(ctx); } catch (error) {
        ctx.logger.warn("签到积分服务不可用", { error: String(error) });
        return render("unavailable");
    }

    if (!points) {
        if (row?.status === "pending") { return render("pending"); }

        if (dateAt(clock()) !== day) { return render("dayChanged"); }

        const acquired = await claim(ctx.db, ctx.botId, userId, day, 0, row, "committed");

        if (acquired) { return completed(acquired); }

        const latest = await find(ctx.db, ctx.botId, userId, day);
        return latest?.status === "committed" ? completed(latest, true) : render("pending");
    }

    const pointsService = points;
    const complete = async (saved: Claim, result: OperationLookup) => {
        if (result.status === "COMMITTED") {
            if (!result.receipt.transactionId) {
                ctx.logger.warn("签到入账回执缺少交易编号", { operationId: saved.operation_id });
                return render("pending");
            }

            await finish(ctx.db, saved, "committed");
            return render("success", "", saved.amount / 100);
        }

        if (result.status === "REJECTED") {
            await finish(ctx.db, saved, "rejected");
            return render("failed", result.error.message);
        }

        return render("pending");
    };

    try {
        if (row?.status === "pending") {
            const lookup = await pointsService.getOperation({ source: SOURCE, operationId: row.operation_id });

            if (!lookup.ok) { return render("pending"); }

            if (lookup.data.status !== "NOT_FOUND") { return await complete(row, lookup.data); }

            // A new user request may resume only this saved operation, with identical input.
        } else {
            const checked = await pointsService.checkAccounts({ source: SOURCE, userIds: [userId] });

            if (!checked.ok) { return render("failed", checked.message); }

            if (!checked.data.accounts.some(account => account.userId === userId && account.exists)) { return render("opening"); }

            if (dateAt(clock()) !== day) { return render("dayChanged"); }

            const acquired = await claim(ctx.db, ctx.botId, userId, day, Math.round(config.rewardPoints * 100), row);

            if (!acquired) {
                row = await find(ctx.db, ctx.botId, userId, day);
                return row?.status === "committed" ? completed(row, true) : render("pending");
            }

            row = acquired;
        }

        const result = await pointsService.credit({ source: SOURCE, operationId: row.operation_id, referenceId: "checkin:" + row.day, userId: row.user_id, amountMinor: row.amount, reason: "每日签到奖励" });

        if (result.ok) { return await complete(row, { status: "COMMITTED", receipt: result.data }); }

        ctx.logger.warn("签到入账未完成", { operationId: row.operation_id, code: result.code, retryable: result.retryable });
        // Only a persisted rejection proves this operation cannot later commit.
        const lookup = await pointsService.getOperation({ source: SOURCE, operationId: row.operation_id });
        return lookup.ok ? await complete(row, lookup.data) : render("pending");
    } catch (error) {
        ctx.logger.warn("签到处理失败", { operationId: row?.operation_id, error: String(error) });
        return render(row?.status === "pending" ? "pending" : "failed", "积分服务暂时不可用");
    }
}
