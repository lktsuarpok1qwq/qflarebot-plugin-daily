export const CHECKIN_COPY = {
    success: "✅ 签到成功\n🎁 获得 {{amount}} 积分\n📅 {{date}}",
    already: "☀️ 今天已经签到，已领取 {{amount}} 积分\n明天再来吧",
    opening: "👛 请先私聊机器人发送 /积分 开户\n开户后再来签到",
    pending: "⏳ 签到结果尚未确认\n请稍后再次签到查询结果，不会重复加分",
    failed: "⚠️ 签到未完成\n{{message}}",
    unavailable: "🔌 积分服务暂不可用，请联系管理员检查签到接入",
    identity: "👤 无法识别当前账户，请重新发送签到命令",
    usage: "📅 发送 /签到\n接入积分后，每天可领取 {{amount}} 积分",
    dayChanged: "📅 日期已变化，请重新签到",
};
export type CheckinCopyKey = keyof typeof CHECKIN_COPY;
