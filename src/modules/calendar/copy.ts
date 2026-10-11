import { declareVariables } from "../../shared/variables.js";
import { commandLink } from "../../shared/interpolation.js";
import { queryComposition, todayComposition } from "./copy-fields.js";
// 日历模块所有可配置默认文案；已有用户配置优先
export const CALENDAR_COPY = {
    text: {
        summary: "🎉 **{{name}}**\n{{date_text}}\n{{status}} {{makeup_text}}\n",
        today: "{{today_text}}\n",
        help: "📅 **假期日历**\n\n🏖️ 把期待放进日历，安排好下一次休息\n\n" + commandLink("🏖️ 下个假期", "/假期 下个") + " · 看看下一次期待\n" + commandLink("📋 今年剩余", "/假期 剩余") + " · 一览今年的节日\n\n" + commandLink("🏠 每日助手", "/每日"),
        dateRange: "📅 {{start}} ～ {{end}} · 休息 {{days_off}} 天",
        dateSingle: "📅 {{date}} · 休息 {{days_off}} 天",
        dateReference: "📅 节日日期 {{date}} · 🗓️ 放假安排待公布",
        dateEvent: "📅 {{date}}",
        upcoming: "⏳ 距离开始还有 {{days_until}} 天", starts: "🎉 今天开始，好好享受假期", ongoing: "🏖️ 假期进行中，给自己放个松",
        ends: "🌇 今天结束，珍惜最后的休息时光", onDay: "🎊 就是今天，节日快乐",
        makeupDates: "💼 调休上班：{{makeup}}", makeupEmpty: "🙌 无调休，安心安排", makeupUnknown: "🗓️ 调休安排待公布",
        todayHolidayText: "🏖️ 今天是 **{{name}}** 假期，放松一下吧", todayMakeupText: "⏰ 今天是 **{{name}}** 调休上班日，记得安排出行", todayReferenceText: "🎊 今天是 **{{name}}**，放假安排待公布", todayEventText: "🎈 今天是 **{{name}}**，值得好好纪念",
        unknown: "🔎 暂时无法获取假期信息，稍后再来看看吧",
        none: "🍃 暂时没有已知的下个节日，先看看今年的安排吧\n" + commandLink("📋 今年剩余", "/假期 剩余"),
        noneRemaining: "📅 今年已没有剩余节日，看看下一份期待吧\n" + commandLink("🏖️ 查看下个假期", "/假期 下个"),

    },
    draft: { name: "" },
};


export const calendarVariables = declareVariables({
    "日历.下一个": { description: "下个尚未开始的节日文案，含跨年", group: "完整文案", composition: queryComposition },
    "日历.今日": { description: "今日节日、放假或调休上班文案", group: "完整文案", composition: todayComposition },
    "日历.今日节日": { description: "仅含当日 DIY 或节日日期记录，不含放假区间和调休", group: "完整文案", composition: todayComposition },
    "日历.今年剩余": { description: "今天起至今年年底所有剩余节日文案", group: "完整文案", composition: queryComposition },
    "日历.节日名称": { description: "最近节日名称，优先进行中的节日", group: "最近节日" },
    "日历.下个节日名称": { description: "下个尚未开始的节日名称，含跨年", group: "下个节日" },
    "日历.剩余天数": { description: "距最近节日开始的天数，进行中为 0", group: "最近节日" },
    "日历.节日日期": { description: "最近节日的单日日期，放假区间时为空", group: "最近节日" },
    "日历.开始日期": { description: "最近节日的放假开始日期，单日节日时为空", group: "最近节日" },
    "日历.结束日期": { description: "最近节日的放假结束日期，单日节日时为空", group: "最近节日" },
    "日历.天数": { description: "最近节日的放假天数，单日节日时为空", group: "最近节日" },
});
