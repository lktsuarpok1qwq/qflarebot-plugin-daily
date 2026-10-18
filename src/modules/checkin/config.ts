import { fields } from "../../shared/validation.js";
import { copyContract } from "./definition.js";
import type { CHECKIN_COPY } from "./copy.js";
export type CheckinConfig = { schemaVersion: 1; rewardPoints: number; copy: typeof CHECKIN_COPY };
export const defaults = (): CheckinConfig => copyContract.defaults({ schemaVersion: 1, rewardPoints: 100 });
export function validate(value: unknown): CheckinConfig {
    const c = value as CheckinConfig;

    if (!c || typeof c !== "object" || Array.isArray(c) || c.schemaVersion !== 1) { throw new Error("签到配置格式错误"); }

    fields(c, ["schemaVersion", "rewardPoints", "copy"]);

    // Points accepts positive minor units, up to 1e12 per operation.
    if (typeof c.rewardPoints !== "number" || c.rewardPoints <= 0 || c.rewardPoints > 10000000000 || !/^\d+(?:\.\d{1,2})?$/.test(String(c.rewardPoints))) {
        throw new Error("签到积分须为 0.01～10000000000，最多两位小数");
    }

    copyContract.validate(c);
    return c;
}
export const parseConfig = (raw: string) => validate(JSON.parse(raw));
