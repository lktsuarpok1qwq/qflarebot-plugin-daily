import type { Config } from "../types.js";
export const HELP = {
  daily:
    "📅 每日助手 · 使用帮助\n\n/每日 帮助    查看使用帮助\n\n自动发送由机器人所有者在管理后台设置。",
  holiday:
    "📅 假期助手 · 使用帮助\n\n/假期 下一个  查询下一个假期\n/假期 剩余    查询今年剩余假期\n/假期 帮助    查看使用帮助。",
};
export const VARIABLES: Record<string, number> = {
  "date.today": 10,
  "date.weekday": 3,
  "holiday.next_name": 80,
  "holiday.days_until": 5,
  "holiday.start_date": 10,
  "holiday.end_date": 10,
};
export function validateTemplate(body: string, limit: number) {
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(body))
    throw new Error("文字包含不支持的控制字符");
  const budget = body.replace(/\{\{([^{}]+)\}\}/g, (_, key: string) => {
    if (!Object.hasOwn(VARIABLES, key)) throw new Error(`未知变量：${key}`);
    return "字".repeat(VARIABLES[key]!);
  });
  if (budget.includes("{{") || budget.includes("}}"))
    throw new Error("变量格式错误");
  if ([...budget].length > limit)
    throw new Error(`模板最大展开长度超过 ${limit}`);
}
export function defaults(): Config {
  return {
    schemaVersion: 1,
    paused: false,
    retentionDays: 30,
    textLimit: 500,
    contents: [],
    tasks: [],
    recipients: [],
    bindings: [],
    regions: [{ id: "CN", name: "中国" }],
    holidays: [],
    coverage: [],
    help: { ...HELP },
  };
}
