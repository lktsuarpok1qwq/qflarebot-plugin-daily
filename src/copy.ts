import type { CommandName, CommandReply } from "./types.js";

/**
 * 可配置文案的默认值统一在这里修改。
 * 命令回复：安装初始化、后台恢复默认、配置读取失败时使用。
 * 新建文案：后台新建任务、目标和假期时使用。
 * 已保存的用户文案优先，修改此文件不会覆盖已有配置。
 * {{变量}} 的名称需保留；支持的变量由模板校验器定义。
 */
const dailyHelp =
  "📅 每日助手 · 使用帮助\n\n/每日 帮助    查看使用帮助\n\n自动发送由机器人所有者在管理后台设置。";
const holidayHelp =
  "📅 假期助手 · 使用帮助\n\n/假期 下一个  查询最近假期（含跨年）\n/假期 剩余    查询今年剩余假期\n/假期 帮助    查看使用帮助。";

// 通用条目和提示；下方各命令可以单独覆盖任意字段。
const commonReply: CommandReply = {
  body: "{{items}}{{stale}}",
  item: "{{name}}：{{start}} 至 {{end}}{{ongoing}}\n共 {{days_off}} 天；调休上班日：{{makeup}}\n",
  empty: "已公布的记录中没有后续假期。",
  unknown: "暂未获取后续放假安排，可稍后同步或手动录入。",
  stale: "\n数据源暂未更新，使用最近可信版本。",
  ongoing: "（进行中）",
  makeupEmpty: "无",
  error: "命令暂时处理失败，请稍后再试。",
  tooLong: "消息超过平台允许的长度，请精简回复模板。",
};

export const COPY = {
  replies: {
    每日: { ...commonReply, body: dailyHelp },
    "每日 帮助": { ...commonReply, body: dailyHelp },
    假期: { ...commonReply, body: holidayHelp },
    "假期 帮助": { ...commonReply, body: holidayHelp },
    "假期 下一个": { ...commonReply },
    "假期 剩余": {
      ...commonReply,
      empty: "今年已没有剩余假期，可用 /假期 下一个 查询下一段假期（含跨年）。",
    },
  } satisfies Record<CommandName, CommandReply>,
  announcement: {
    name: "每日公告",
    body: "# 每日公告\n今天是 {{日期}}，{{星期}}\n\n{{假期.概览}}",
  },
  holiday: {
    summary:
      "{{name}}：{{start}} 至 {{end}}，共 {{days_off}} 天，距开始 {{days_until}} 天{{ongoing}}。",
    today: "今天是{{name}}假期。",
    makeupToday: "今天是{{name}}调休上班日。",
    ordinary: "今天没有放假或调休安排。",
    unknown: "暂未获取放假安排。",
    none: "已收录的假期均已结束。",
    ongoing: "（进行中）",
    stale: "（使用缓存数据）",
  },
  drafts: {
    task: { name: "新任务", body: "" },
    recipient: { name: "" },
    holiday: { name: "" },
    copySuffix: " 副本",
  },
};
