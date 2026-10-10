import { definePlugin } from "@qqbot/sdk";
import { install } from "./data/repository.js";
import { dispatch } from "./scheduler/dispatcher.js";
import { maintenance } from "./data/holiday-cn.js";
import { help, queryHoliday } from "./commands.js";
import { api } from "./admin.js";
import { HTML } from "./ui.js";
export default definePlugin({
  name: "daily",
  displayName: "每日助手",
  description: "定时文字、每日汇总与假期查询",
  apiVersion: 2,
  permissions: ["db", "net", "proactive", "admin"],
  hooks: { onInstall: install },
  commands: {
    每日: {
      description: "每日助手帮助",
      scenes: ["group", "c2c"],
      handler: ({ ctx }) => help(ctx, "daily"),
    },
    "每日 帮助": {
      description: "查看每日帮助",
      scenes: ["group", "c2c"],
      handler: ({ ctx }) => help(ctx, "daily"),
    },
    假期: {
      description: "假期查询帮助",
      scenes: ["group", "c2c"],
      handler: ({ ctx }) => help(ctx, "holiday"),
    },
    "假期 帮助": {
      description: "查看假期帮助",
      scenes: ["group", "c2c"],
      handler: ({ ctx }) => help(ctx, "holiday"),
    },
    "假期 下一个": {
      description: "下个尚未结束的假期",
      scenes: ["group", "c2c"],
      handler: ({ ctx }) => queryHoliday(ctx, "next"),
    },
    "假期 剩余": {
      description: "今年尚未结束的假期",
      scenes: ["group", "c2c"],
      handler: ({ ctx }) => queryHoliday(ctx, "remaining"),
    },
  },
  cron: {
    send: { cron: "* * * * *", handler: ({ ctx }) => dispatch(ctx) },
    sync: {
      cron: "10,11,12 19 * * *",
      handler: ({ ctx, scheduledAt }) =>
        maintenance(
          ctx,
          "sync",
          scheduledAt,
          false,
          (new Date(scheduledAt).getUTCMinutes() - 11) as -1 | 0 | 1,
        ),
    },
    cleanup: {
      cron: "40 19 * * *",
      handler: ({ ctx, scheduledAt }) =>
        maintenance(ctx, "cleanup", scheduledAt),
    },
  },
  ui: { path: "/ui/", title: "每日助手", icon: "CalendarDays" },
  routes: [
    {
      method: "GET",
      path: "/ui/*",
      auth: "admin",
      handler: ({ authenticated }) =>
        authenticated
          ? new Response(HTML, {
              headers: {
                "content-type": "text/html; charset=utf-8",
                "cache-control": "no-store",
              },
            })
          : new Response("需要登录", { status: 401 }),
    },
    ...(["GET", "POST"] as const).map((method) => ({
      method,
      path: "/api/:action",
      auth: "admin" as const,
      handler: api,
    })),
  ],
});
