import type { ButtonConfiguration } from "../../shared/message-buttons.js";
import { fields } from "../../shared/validation.js";
import { copyContract, rewardSetting } from "./definition.js";
import type { CheckinCopy } from "./copy.js";

export type CheckinConfig = ButtonConfiguration & {
    schemaVersion: 1; rewardPoints: number; streakDays: number; rewardMultiplier: number; rankingSize: number; copy: CheckinCopy;
};
export const defaults = (): CheckinConfig => copyContract.defaults({ schemaVersion: 1, rewardPoints: 100, streakDays: 7, rewardMultiplier: 2, rankingSize: 10 });

export function validate(value: unknown): CheckinConfig {
    const c = value as CheckinConfig;

    if (!c || typeof c !== "object" || Array.isArray(c) || c.schemaVersion !== 1) { throw new Error("签到配置格式错误"); }

    fields(c, ["schemaVersion", "buttons", "rewardPoints", "streakDays", "rewardMultiplier", "rankingSize", "copy"]);

    if (typeof c.rewardPoints !== "number" || c.rewardPoints < rewardSetting.min || c.rewardPoints > rewardSetting.max || !/^\d+(?:\.\d{1,2})?$/.test(String(c.rewardPoints))) {
        throw new Error("签到积分须为 0.01～10000000000，最多两位小数");
    }

    for (const [key, min, max] of [["streakDays", 1, 36500], ["rewardMultiplier", 1, 10000], ["rankingSize", 1, 50]] as const) {
        if (!Number.isSafeInteger(c[key]) || c[key] < min || c[key] > max) { throw new Error("连续奖励或榜单设置超出范围"); }
    }

    if (Math.round(c.rewardPoints * 100) * c.rewardMultiplier > 1000000000000) { throw new Error("加成后的奖励超过积分单笔上限"); }

    copyContract.validate(c);

    return c;
}

export const parseConfig = (raw: string) => validate(JSON.parse(raw));
