import type { CommandName, CommandReply } from "../types.js";
export const COMMAND_NAMES = [
  "每日",
  "每日 帮助",
  "假期",
  "假期 帮助",
  "假期 下一个",
  "假期 剩余",
] as const;
const HELP = {
  daily:
    "📅 每日助手 · 使用帮助\n\n/每日 帮助    查看使用帮助\n\n自动发送由机器人所有者在管理后台设置。",
  holiday:
    "📅 假期助手 · 使用帮助\n\n/假期 下一个  查询最近假期或节日（含跨年）\n/假期 剩余    查询今年剩余假期或节日\n/假期 帮助    查看使用帮助。",
};
export function defaultReplies(): Record<CommandName, CommandReply> {
  return Object.fromEntries(
    COMMAND_NAMES.map((name) => [
      name,
      {
        format: "plain",
        body:
          name === "每日" || name === "每日 帮助"
            ? HELP.daily
            : name === "假期" || name === "假期 帮助"
              ? HELP.holiday
              : "{{items}}{{stale}}",
        official:
          "{{name}}：{{start}} 至 {{end}}{{ongoing}}\n共 {{days_off}} 天；调休上班日：{{makeup}}",
        provisional:
          "{{name}}：{{date}}（节日日期，距今 {{days_until}} 天；放假安排尚未公布）",
        separator: "\n",
        empty:
          name === "假期 剩余"
            ? "今年已没有剩余假期，可用 /假期 下一个 查询下一段假期（含跨年）。"
            : "已公布的记录中没有后续假期。",
        unknown: "后续假期安排尚未公布或数据尚未同步，可稍后同步或手动录入。",
        stale: "\n数据源暂未更新，使用最近可信版本。",
        ongoing: "（进行中）",
        makeupEmpty: "无",
        error: "命令暂时处理失败，请稍后再试。",
        tooLong: "消息超过平台允许的长度，请精简回复模板。",
      },
    ]),
  ) as Record<CommandName, CommandReply>;
}
export const REPLY_FIELDS = [
  "body",
  "official",
  "provisional",
  "separator",
  "empty",
  "unknown",
  "stale",
  "ongoing",
  "makeupEmpty",
  "error",
  "tooLong",
] as const;

export function replyVariables(
  name: CommandName,
  field: (typeof REPLY_FIELDS)[number],
): string[] {
  const common = ["year", "today"];
  if (field === "body" && !["假期 下一个", "假期 剩余"].includes(name))
    return common;
  if (field === "body") return [...common, "items", "stale", "count"];
  if (field === "official" || field === "ongoing")
    return [
      ...common,
      "name",
      "start",
      "end",
      "days_until",
      "days_off",
      "makeup",
      "source",
      ...(field === "official" ? ["ongoing"] : []),
    ];
  if (field === "provisional")
    return [...common, "name", "date", "days_until", "source"];
  return common;
}
