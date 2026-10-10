import type { Config } from "../types.js";
import { COPY } from "../copy.js";
import { defaultReplies } from "./command-templates.js";
import { moduleVariables } from "../modules/index.js";
export const VARIABLES = ["日期", "星期", ...moduleVariables] as const;
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
export function defaults(): Config {
  return {
    schemaVersion: 2,
    paused: false,
    retentionDays: 30,
    tasks: [
      {
        id: "daily-announcement",
        ...COPY.announcement,
        enabled: false,
        origin: "system",
        schedule: { kind: "daily", time: "09:00" },
      },
    ],
    recipients: [],
    bindings: [],
    holidays: [],
    holidayCopy: structuredClone(COPY.holiday),
    replies: defaultReplies(),
  };
}
