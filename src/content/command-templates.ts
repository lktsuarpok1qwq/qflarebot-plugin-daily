import type { CommandName, CommandReply } from "../types.js";
import { COPY } from "../copy.js";
export const COMMAND_NAMES = [
  "每日",
  "每日 帮助",
  "假期",
  "假期 帮助",
  "假期 下一个",
  "假期 剩余",
] as const;
export function defaultReplies(): Record<CommandName, CommandReply> {
  return structuredClone(COPY.replies);
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
