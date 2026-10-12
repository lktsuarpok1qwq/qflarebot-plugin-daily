import type { VariableComposition } from "../../shared/variables.js";
const rawVariables = {
    name: "当前条目的节日名称", date: "单日条目日期，多日条目为空", start: "放假开始日期", end: "放假结束日期",
    days_until: "距开始天数，正在经历为 0", days_off: "已知放假天数", source: "数据来源",
    makeup: "已知调休日期，安排未知时为空", year: "当前年份", today: "今天日期",
};
const fragmentVariables = { date_text: "日期说明", status: "当前条目的状态说明", makeup_text: "调休说明", today_text: "今日说明" };
export const itemVariables = { ...rawVariables, ...fragmentVariables };
const queryVariables = { ...rawVariables, date_text: fragmentVariables.date_text, status: fragmentVariables.status, makeup_text: fragmentVariables.makeup_text };
const todayVariables = { ...rawVariables, today_text: fragmentVariables.today_text };
export const calendarCopyVariables = {
    summary: Object.keys(queryVariables), today: Object.keys(todayVariables), help: ["year", "today"],
    dateRange: ["name", "start", "end", "days_off"], dateSingle: ["name", "date", "days_off"], dateReference: ["name", "date"], dateEvent: ["name", "date"],
    upcoming: ["name", "days_until"], starts: ["name"], ongoing: ["name"], ends: ["name"], onDay: ["name"],
    makeupDates: ["name", "makeup"], makeupEmpty: ["name"], makeupUnknown: ["name"],
    todayHolidayText: ["name"], todayMakeupText: ["name"], todayReferenceText: ["name"], todayEventText: ["name"],
    unknown: ["year", "today"], none: ["year", "today"], noneRemaining: ["year", "today"],
};
export const fragmentCompositions: Record<string, VariableComposition> = {
    date_text: { description: "按条目类型生成日期或放假区间，未知安排不会推算天数", scope: "这些字段可在当前日历条目模板中直接使用", fields: { date: rawVariables.date, start: rawVariables.start, end: rawVariables.end, days_off: rawVariables.days_off } },
    status: { description: "按日期生成倒计时、今天开始、进行中或今天结束说明", scope: "这些字段可在当前日历条目模板中直接使用", fields: { days_until: rawVariables.days_until, today: rawVariables.today } },
    makeup_text: { description: "显示调休日期，区分已确认无调休和安排未知", scope: "这些字段可在当前日历条目模板中直接使用", fields: { makeup: rawVariables.makeup } },
    today_text: { description: "按条目类型生成当天放假、调休或节日说明", scope: "这些字段可在当前日历条目模板中直接使用", fields: { name: rawVariables.name } },
};
export const queryComposition: VariableComposition = {
    description: "每个节日使用同一份查询条目模板，多个条目按日期排序直接拼接，间隔由条目模板中的换行决定",
    scope: "以下字段仅在日历查询条目模板中使用，不能直接放进通知正文",
    fields: queryVariables,
};
export const todayComposition: VariableComposition = {
    description: "当天每个条目使用同一份今日提醒模板，多个条目直接拼接，间隔由条目模板中的换行决定",
    scope: "以下字段仅在日历今日提醒模板中使用，不能直接放进通知正文",
    fields: todayVariables,
};
