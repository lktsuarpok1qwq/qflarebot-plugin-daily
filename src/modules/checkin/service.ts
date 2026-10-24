import { qqAt } from "@qqbot/sdk";
import type { Ctx } from "../../shared/types.js";
import { addDays, dateAt } from "../../shared/date.js";
import { expand, joinItems } from "../../shared/interpolation.js";
import type { CheckinCopyKey } from "./copy.js";
import { attend, current, ranking, snapshot, type Totals } from "./repository.js";
import { reward } from "./reward.js";

type Context = { scene: string; targetId: string; name: string };

export async function checkin(ctx: Ctx, userId: string, args: readonly string[], clock = Date.now, context?: Context) {
    const day = dateAt(clock()), yesterday = addDays(day, -1);
    const group = context?.scene === "group" ? context.targetId : "";
    const action = !args.length ? "checkin" : args.length === 1 && (args[0] === "榜" || args[0] === "我的") ? args[0] : "help";
    const valid = Boolean(userId?.trim() && ctx.botId?.trim());
    const state = valid && ["checkin", "我的"].includes(action!)
        ? await current(ctx.db, ctx.botId, userId, action === "checkin" ? { day, group } : undefined)
        : { ...await snapshot(ctx.db), record: null, totals: null, groupSeen: false };
    const { config } = state;
    let totals = state.totals;
    const streak = (value: Totals | null) => value && value.last_day >= yesterday ? value.streak : 0;
    const render = (key: CheckinCopyKey, amount = config.rewardPoints, message = "", items = "") => ({
        buttons: config.buttons?.[action === "榜" ? "ranking" : action === "我的" ? "mine" : "command"],
        text: expand(config.copy[key] ?? "", {
            date: day, amount: String(amount), message, total: String(totals?.total ?? 0), streak: String(streak(totals)),
            last_day: totals?.last_day ?? "—", threshold: String(config.streakDays), multiplier: String(config.rewardMultiplier)
        }, { items, today_status: totals?.last_day === day ? config.copy.todaySigned : config.copy.todayUnsigned }),
    });

    if (!valid) { return render("identity"); }

    if (action === "榜") {
        if (!group) { return render("groupOnly"); }

        const rows = await ranking(ctx.db, ctx.botId, group, config.rankingSize);
        let rank = 0;
        const items = joinItems(rows.map((row, index) => {
            if (index === 0 || rows[index - 1]!.total !== row.total) { rank = index + 1; }

            return expand(config.copy.rankingItem, { rank: String(rank), name: row.name || row.user_id, total: String(row.total), streak: String(streak(row)) }, row.name ? {} : { name: qqAt(row.user_id) });
        }), config.copy.rankingSeparator);

        return render(rows.length ? "ranking" : "emptyRanking", 0, "", items);
    }

    if (action === "我的") { return render("mine"); }

    if (action !== "checkin") { return render("usage"); }

    if (dateAt(clock()) !== day) { return render("dayChanged"); }

    const personal = !totals || totals.last_day < day;
    const dueGroup = group && !state.groupSeen ? group : "";

    if (personal || dueGroup) { totals = await attend(ctx.db, ctx.botId, userId, day, context?.name ?? "", { personal, group: dueGroup }, totals); }

    if ((!totals || totals.last_day !== day) && state.record?.status !== "committed") { return render("dayChanged"); }

    const amount = Math.round(config.rewardPoints * 100) * ((totals?.streak ?? 0) > config.streakDays ? config.rewardMultiplier : 1);
    const result = await reward(ctx, userId, day, amount, state.record, clock);

    return render(result.key, result.amount, result.message);
}
