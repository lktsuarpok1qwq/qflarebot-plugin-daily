import type { CommandReply } from "./shared/types.js";

const help = "📅 **每日助手**\n\n✨ 点选下方功能，看看今天有什么新鲜事\n{{commands}}\n\n🔔 定时通知由机器人所有者在后台设置";
const reply: CommandReply = {
    body: help,
};
// 通用功能的可配置默认文案；业务模块在各自目录集中维护
export const COPY = {
    commandFeedback: { error: "🛠️ 这次没能完成查询，请稍后再试", tooLong: "📏 内容有点长，超过平台消息上限，请缩短后再试" },
    replies: { 每日: { ...reply } },
};
