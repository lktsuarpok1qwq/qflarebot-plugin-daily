import type { Config } from "../types.js";
import { defaultReplies } from "./command-templates.js";
export const VARIABLES = [
  "date.today",
  "date.weekday",
  "holiday.next_name",
  "holiday.days_until",
  "holiday.start_date",
  "holiday.end_date",
  "holiday.days_off",
  "festival.name",
  "festival.date",
  "festival.days_until",
] as const;
export function validateTemplate(
  body: string,
  keys: readonly string[] = VARIABLES,
) {
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(body))
    throw new Error("文字包含不支持的控制字符");
  const rest = body.replace(/\{\{([^{}]+)\}\}/g, (_, key: string) => {
    if (!keys.includes(key)) throw new Error(`未知变量：${key}`);
    return "";
  });
  if (rest.includes("{{") || rest.includes("}}"))
    throw new Error("变量格式错误");
}
export function expand(
  body: string,
  values: Record<string, string>,
  markdown = false,
) {
  return body.replace(/\{\{([^{}]+)\}\}/g, (_, key: string) => {
    const value = values[key] ?? "";
    return markdown
      ? value.replace(/([\\`*_{}[\]()<>#+.!|~-])/g, "\\$1")
      : value;
  });
}
export function defaults(): Config {
  return {
    schemaVersion: 1,
    paused: false,
    retentionDays: 30,
    contents: [],
    tasks: [],
    recipients: [],
    bindings: [],
    holidays: [],
    replies: defaultReplies(),
    festivals: [],
  };
}
