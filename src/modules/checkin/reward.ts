import type { PointsService, OperationLookup } from "qflarebot-plugin-points";
import type { Ctx } from "../../shared/types.js";
import type { CheckinCopyKey } from "./copy.js";
import { dateAt } from "../../shared/date.js";
import { claim, find, finish, type Claim } from "./repository.js";

export const SOURCE = "daily";

export function wallet(ctx: Ctx) {
    let service: PointsService;

    try { service = ctx.service<PointsService>("points.wallet"); } catch { return undefined; }

    if (![service.checkAccounts, service.getSourcePolicy, service.registerSource, service.credit, service.getOperation].every(method => typeof method === "function")) {
        throw new Error("积分服务契约不完整，请更新 Points 插件");
    }

    return service;
}

type RewardResult = { key: CheckinCopyKey; amount: number; message?: string };

export async function reward(ctx: Ctx, userId: string, day: string, amount: number, record: Claim | null, clock: () => number): Promise<RewardResult> {
    const done = (row: Claim, repeated = false): RewardResult => ({ key: repeated ? "already" : row.amount ? "success" : "plain", amount: row.amount / 100 });

    if (record?.status === "committed") { return done(record, true); }

    let points: PointsService | undefined;

    try { points = wallet(ctx); } catch (error) {
        ctx.logger.warn("签到积分服务不可用", { error: String(error) });

        return { key: "unavailable", amount: 0 };
    }

    let row = record;
    const pending = (): RewardResult => ({ key: "pending", amount: row?.amount ? row.amount / 100 : 0 });
    const complete = async (saved: Claim, result: OperationLookup): Promise<RewardResult> => {
        if (result.status === "COMMITTED") {
            if (!result.receipt.transactionId) {
                ctx.logger.warn("签到入账回执缺少交易编号", { operationId: saved.operation_id });

                return pending();
            }

            await finish(ctx.db, saved, "committed");

            return done(saved);
        }

        if (result.status === "REJECTED") {
            await finish(ctx.db, saved, "rejected");

            return { key: "failed", amount: 0, message: result.error.message };
        }

        return pending();
    };

    try {
        if (row?.status === "pending") {
            if (!points) { return pending(); }

            const lookup = await points.getOperation({ source: SOURCE, operationId: row.operation_id });

            if (!lookup.ok) { return pending(); }

            if (lookup.data.status !== "NOT_FOUND") { return await complete(row, lookup.data); }
        } else {
            let eligible = false;

            if (points) {
                const checked = await points.checkAccounts({ source: SOURCE, userIds: [userId] });

                if (!checked.ok) { return { key: "failed", amount: 0, message: checked.message }; }

                eligible = checked.data.accounts.some(account => account.userId === userId && account.exists);
            }

            if (dateAt(clock()) !== day) { return { key: "dayChanged", amount: 0 }; }

            // 未开户或未接入时也完成签到，金额为零的记录不补发
            const acquired = await claim(ctx.db, ctx.botId, userId, day, eligible ? amount : 0, row, eligible ? "pending" : "committed");

            if (!acquired) {
                const latest = await find(ctx.db, ctx.botId, userId, day);

                return latest?.status === "committed" ? done(latest, true) : pending();
            }

            row = acquired;

            if (!eligible) { return { key: points ? "opening" : "plain", amount: 0 }; }
        }

        const result = await points!.credit({ source: SOURCE, operationId: row.operation_id, referenceId: "checkin:" + row.day, userId: row.user_id, amountMinor: row.amount, reason: "每日签到奖励" });

        if (result.ok) { return await complete(row, { status: "COMMITTED", receipt: result.data }); }

        ctx.logger.warn("签到入账未完成", { operationId: row.operation_id, code: result.code, retryable: result.retryable });
        const lookup = await points!.getOperation({ source: SOURCE, operationId: row.operation_id });

        return lookup.ok ? await complete(row, lookup.data) : pending();
    } catch (error) {
        ctx.logger.warn("签到积分处理失败", { operationId: row?.operation_id, error: String(error) });

        return row?.status === "pending" ? pending() : { key: "failed", amount: 0, message: "积分服务暂时不可用" };
    }
}
