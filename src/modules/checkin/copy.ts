export const CHECKIN_COPY = {
    success: "✅ 签到成功\n📅 累计 {{total}} 天 · 连续 {{streak}} 天\n🎁 获得 {{amount}} 积分",
    already: "今天已经签到",
    opening: "✅ 签到成功\n📅 累计 {{total}} 天 · 连续 {{streak}} 天\n👛 尚未开户，本次不发积分\n私聊机器人发送 /积分 开户，次日起可领取",
    plain: "✅ 签到成功\n📅 累计 {{total}} 天 · 连续 {{streak}} 天\n本次无积分奖励",
    pending: "✅ 今天已签到\n📅 累计 {{total}} 天 · 连续 {{streak}} 天\n⏳ 积分结果尚未确认，再次签到可查询，不会重复加分",
    failed: "✅ 今天已签到\n📅 累计 {{total}} 天 · 连续 {{streak}} 天\n⚠️ 积分未发放：{{message}}",
    unavailable: "✅ 今天已签到\n📅 累计 {{total}} 天 · 连续 {{streak}} 天\n🔌 积分服务暂不可用",
    identity: "👤 无法识别当前账户，请重新发送签到命令",
    usage: "📅 /签到 · 每天记录一次\n🎁 基础 {{amount}} 积分，连续超过 {{threshold}} 天后 ×{{multiplier}}\n🏆 /签到 榜 · 本群个人签到榜\n👤 /签到 我的 · 查看个人签到",
    dayChanged: "📅 日期已变化，请重新签到",
    mine: "👤 我的签到\n{{today_status}}\n📅 个人累计 {{total}} 天 · 个人连续 {{streak}} 天\n最近签到 {{last_day}}",
    todaySigned: "✅ 今天已签到",
    todayUnsigned: "📝 今天未签到",
    ranking: "🏆 本群个人签到榜\n{{items}}",
    rankingItem: "{{rank}}. {{name}} · 个人累计 {{total}} 天 · 个人连续 {{streak}} 天",
    rankingSeparator: "\n",
    emptyRanking: "📋 本群还没有签到记录",
    groupOnly: "🏆 请在群聊中查看本群签到榜",
};
export type CheckinCopyKey = keyof typeof CHECKIN_COPY;
export type CheckinCopy = Omit<typeof CHECKIN_COPY, "rankingSeparator"> & { rankingSeparator?: string };
