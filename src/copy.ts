import type { CommandReply } from "./shared/types.js";

const help = "📅 每日助手 · 使用帮助\n\n**/每日**  查看帮助\n\n自动发送由机器人所有者在管理后台设置";
const reply: CommandReply = {
    body: help,
};
// 通用功能的可配置默认文案；业务模块在各自目录集中维护
export const COPY = {
    commandFeedback: { error: "命令暂时处理失败，请稍后再试", tooLong: "消息超过平台允许的长度，请精简文案" },
    replies: { 每日: { ...reply } },
    announcement: { name: "每日公告", body: "# 📣 每日公告\n今天是 {{日期}}，{{星期}}" },
    drafts: {
        task: { name: "新任务" },
        template: { name: "新模板", body: "" },
        recipient: { name: "" },
        taskTemplateSuffix: " · 独立文案",
        copySuffix: " 副本",
    },
};
