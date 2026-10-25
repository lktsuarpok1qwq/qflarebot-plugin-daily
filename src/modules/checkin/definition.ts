import { createCopyContract } from "../../shared/copy-contract.js";
import { outputTargets, type CopyField, type CopyDeclaration, type SettingsDeclaration } from "../../shared/declarations.js";
import { CHECKIN_COPY, type CheckinCopyKey } from "./copy.js";

export const commands = [{ name: "签到", description: "每日签到" }, { name: "签到 榜", description: "本群个人签到榜" }, { name: "签到 我的", description: "个人签到记录" }];
const labels: Record<CheckinCopyKey, string> = {
    success: "签到成功", already: "已签到", opening: "未开户", plain: "无积分奖励", pending: "积分待确认", failed: "积分未发放", unavailable: "积分服务不可用",
    identity: "身份不可用", usage: "命令用法", dayChanged: "日期变化", mine: "个人记录", todaySigned: "今天已签到", todayUnsigned: "今天未签到", ranking: "榜单格式", rankingItem: "榜单条目", rankingSeparator: "榜单间隔", emptyRanking: "暂无记录", groupOnly: "群聊提示",
};
const stats = { total: "个人累计签到天数", streak: "个人连续签到天数，各群与私聊共用；断签后为 0" };
const resultKeys = ["success", "already", "opening", "plain", "pending", "failed", "unavailable"];
const mineKeys = ["mine", "todaySigned", "todayUnsigned"];
const rankKeys = ["ranking", "rankingItem", "rankingSeparator", "emptyRanking", "groupOnly"];
const sampleIds = (key: CheckinCopyKey) => key === "success" ? ["base", "bonus"] : key === "already" ? ["base", "bonus", "plain"]
    : key === "mine" ? ["mine", "mineUnsigned"] : key === "todaySigned" ? ["mine"] : key === "todayUnsigned" ? ["mineUnsigned"] : [["rankingItem", "rankingSeparator"].includes(key) ? "ranking" : key];
const fields: Record<string, CopyField> = Object.fromEntries((Object.keys(CHECKIN_COPY) as CheckinCopyKey[]).map((key): [string, CopyField] => [key, {
    label: labels[key], category: key === "rankingSeparator" ? "榜单间隔" : key === "rankingItem" ? "榜单条目" : rankKeys.includes(key) ? "榜单文案" : ["todaySigned", "todayUnsigned"].includes(key) ? "今日状态"
        : key === "mine" ? "个人记录" : resultKeys.includes(key) ? "签到结果" : "操作提示",
    path: ["copy", key], inputId: "checkin-" + key, default: CHECKIN_COPY[key], samples: sampleIds(key),
    ...(key === "rankingSeparator" ? { optional: true, presentation: "separator" as const } : {}),
    buttons: ["rankingSeparator", "rankingItem", "todaySigned", "todayUnsigned"].includes(key) ? false : undefined,
    allowEmpty: ["rankingSeparator", "todaySigned", "todayUnsigned"].includes(key),
    variables: resultKeys.includes(key) ? { ...stats, amount: key === "pending" ? "待确认的奖励积分，到账以最终结果为准" : "本次积分，未发放时为 0", date: "签到日期", message: "积分错误说明，其余状态为空" }
        : key === "usage" ? { amount: "基础签到积分", threshold: "连续奖励门槛，超过后加成", multiplier: "奖励倍数" }
            : key === "mine" ? { ...stats, date: "今天日期", last_day: "最近签到日期，无记录时为 —", today_status: "今天是否已签到，使用今日状态文案" }
                : key === "ranking" ? { items: "本群签到者按个人累计天数排名，条目之间使用榜单间隔" }
                    : key === "rankingItem" ? { ...stats, rank: "名次，个人累计天数相同则并列", name: "用户名称，无名称时使用 SDK 提及" } : {},
}]));
const values = { amount: "0", date: "2026-10-25", message: "积分来源尚未启用", total: "8", streak: "8", threshold: "7", multiplier: "2", last_day: "2026-10-25", name: "小明", rank: "1" };
const declaration: CopyDeclaration = {
    id: "checkin", title: "签到文案", initial: "command",
    outputs: outputTargets([{ id: "command", command: "签到" }, { id: "ranking", command: "签到 榜" }, { id: "mine", command: "签到 我的" }]), fields,
    categoryParents: { 榜单条目: "榜单文案", 榜单间隔: "榜单文案", 今日状态: "个人记录" },
    variableCompositions: {
        items: { description: "逐条使用榜单条目模板并直接拼接", scope: "以下变量仅在榜单条目中使用", fields: { rank: "名次", name: "用户", total: "个人累计天数", streak: "个人连续天数" } },
    },
    samples: [
        ...(["opening", "plain", "pending", "failed", "unavailable", "identity", "usage", "dayChanged", "emptyRanking", "groupOnly"] as const).map(key => ({
            id: key, name: labels[key], values: { ...values, amount: key === "usage" ? "100" : key === "pending" ? "200" : "0" },
        })),
        { id: "base", name: "基础奖励", values: { ...values, total: "7", streak: "7", amount: "100" } },
        { id: "bonus", name: "连续奖励", values: { ...values, amount: "200" } },
        { id: "mine", name: "今天已签到", values },
        { id: "mineUnsigned", name: "今天未签到", values: { ...values, last_day: "2026-10-24" } },
        { id: "ranking", name: "个人排名与并列", values: { ...values, total: "12", name2: "小红", total2: "12", streak2: "3", rank2: "1", name3: "小刚", total3: "10", streak3: "0", rank3: "3" } },
    ],
    views: [
        { id: "command", keys: Object.keys(CHECKIN_COPY).filter(key => !mineKeys.includes(key) && !rankKeys.includes(key)), targets: ["command"] },
        { id: "ranking", keys: rankKeys, targets: ["ranking"] },
        { id: "mine", keys: [...mineKeys, "identity"], targets: ["mine"] },
    ],
};
export const copyContract = createCopyContract<{ copy: typeof CHECKIN_COPY }>(declaration);
export const rewardSetting = { key: "rewardPoints", id: "checkinReward", label: "基础积分", type: "number", step: 0.01, min: 0.01, max: 10000000000, hint: "默认 100，最多两位小数" } as const;
export const settings: SettingsDeclaration = {
    id: "checkin-settings", title: "签到设置",
    fields: [rewardSetting,
        { key: "streakDays", id: "checkinStreak", label: "连续奖励门槛", type: "number", step: 1, min: 1, max: 36500, hint: "默认 7，连续第 8 天起获得加成；断签重新计数" },
        { key: "rewardMultiplier", id: "checkinMultiplier", label: "奖励倍数", type: "number", step: 1, min: 1, max: 10000, hint: "默认 2，不叠乘；加成后须符合积分单笔上限" },
        { key: "rankingSize", id: "checkinRanking", label: "群榜人数", type: "number", step: 1, min: 1, max: 50, hint: "默认 10，本群参与者按个人累计天数排序" },
    ],
};
