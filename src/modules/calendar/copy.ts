import type { CalendarCopy } from "./types.js";
// 日历模块所有可配置默认文案；已有用户配置优先
export const CALENDAR_COPY = {
    text: {
        summary:
            "🎉 **{{name}}**{{ongoing}}\n📅 {{start}} 至 {{end}} · 共 {{days_off}} 天\n⏳ 距开始 {{days_until}} 天\n💼 调休上班：{{makeup}}\n",
        reference: "📅 **{{name}}**：{{date}}\n⏳ 还有 {{days_until}} 天 · 节日日期已知，放假安排待公布\n",
        event: "🎈 **{{name}}**：{{date}} · 还有 {{days_until}} 天\n",
        eventToday: "🎉 今天是{{name}}\n",
        today: "🎉 今天是{{name}}假期",
        makeupToday: "💼 今天是{{name}}调休上班日",
        ordinary: "",
        unknown: "📅 暂未获取完整安排，可稍后查询",
        none: "📅 已知记录中没有尚未开始的节日",
        noneRemaining: "📅 今年已没有剩余节日\n可用 **/假期 下个** 查询后续节日",
        ongoing: "（进行中）",
        makeupEmpty: "无",
        stale: "🕒 暂时使用缓存数据",
        help: "📅 日历助手 · 使用帮助\n\n**/假期 下个**  查询尚未开始的节日（含跨年）\n**/假期 剩余**  查询今年剩余节日（含进行中）\n**/假期**  查看帮助",
    } satisfies CalendarCopy,
    draft: { name: "" },
};
