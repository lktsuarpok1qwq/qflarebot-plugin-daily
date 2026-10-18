import { createCopyContract } from "../../shared/copy-contract.js";
import { outputTargets, type CopyField, type CopyDeclaration, type SettingsDeclaration } from "../../shared/declarations.js";
import { CHECKIN_COPY, type CheckinCopyKey } from "./copy.js";
export const commands = [{ name: "签到", description: "每日签到" }];
const labels: Record<CheckinCopyKey, string> = { success: "签到成功", already: "已签到", opening: "未开户", pending: "结果待确认", failed: "签到失败", unavailable: "服务不可用", identity: "身份不可用", usage: "命令用法", dayChanged: "日期变化" };
const fields: Record<string, CopyField> = Object.fromEntries((Object.keys(CHECKIN_COPY) as CheckinCopyKey[]).map((key): [string, CopyField] => [key, {
    label: labels[key], category: ["success", "already"].includes(key) ? "签到结果" : "操作提示",
    path: ["copy", key], inputId: "checkin-" + key, default: CHECKIN_COPY[key], samples: key === "success" || key === "already" ? [key, key + "Plain"] : [key],
    variables: key === "success" || key === "already" ? { amount: "本次获得积分，未接入积分时为 0", date: "签到日期" } : key === "usage" ? { amount: "设置的每日签到积分" } : key === "failed" ? { message: "积分服务错误说明" } : {},
}]));
const declaration: CopyDeclaration = {
    id: "checkin", title: "签到文案", initial: "command", outputs: outputTargets([{ id: "command", command: "签到" }]), fields,
    samples: [
        ...(Object.keys(CHECKIN_COPY) as CheckinCopyKey[]).map(key => ({ id: key, name: labels[key], values: { amount: "100", date: "2026-10-19", message: "积分来源尚未启用" } })),
        ...(["success", "already"] as const).map(key => ({ id: key + "Plain", name: labels[key] + " · 无积分", values: { amount: "0", date: "2026-10-19" } })),
    ],
    views: [{ id: "command", keys: Object.keys(CHECKIN_COPY), targets: ["command"] }],
};
export const copyContract = createCopyContract<{ copy: typeof CHECKIN_COPY }>(declaration);
export const settings: SettingsDeclaration = {
    id: "checkin-settings", title: "签到设置", description: "同一账户每天签到一次",
    fields: [{ key: "rewardPoints", id: "checkinReward", label: "签到积分", type: "number", step: 0.01, hint: "默认 100，最多两位小数；仅影响新认领的签到" }],
};
