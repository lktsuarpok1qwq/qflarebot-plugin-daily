import { calendarSamples } from "./samples.js";
import { outputTargets, type CopyDeclaration } from "../../shared/declarations.js";
import { CALENDAR_COPY } from "./copy.js";
import { itemVariables, fragmentCompositions, calendarCopyVariables } from "./copy-fields.js";
import type { CalendarCopy } from "./types.js";
export const commands = [
    { name: "假期", description: "假期查询帮助" },
    { name: "假期 下个", description: "下个尚未开始的节日" },
    { name: "假期 剩余", description: "今天起今年所有剩余节日" },
];
export const outputs = outputTargets([
    { id: "help", command: commands[0]!.name },
    { id: "next", command: commands[1]!.name },
    { id: "remaining", command: commands[2]!.name },
    { id: "variable-next", variable: "日历.下一个" },
    { id: "variable-remaining", variable: "日历.今年剩余" },
    { id: "today", variable: "日历.今日" },
    { id: "eventToday", variable: "日历.今日节日" },
]);

const branches: Record<keyof CalendarCopy, { category: string; label: string; samples: string[]; sampleNames?: Record<string, string>; targets?: string[] }> = {
    help: { category: "帮助", label: "帮助正文", samples: ["help"] },
    summary: { category: "整体文案", label: "节日条目", samples: ["future", "single", "first", "during", "last", "reference", "diy", "multiple", "partial"] },
    today: { category: "整体文案", label: "今日条目", samples: ["diy", "multiple", "makeup", "referenceToday"] },
    dateRange: { category: "日期信息", label: "放假区间", samples: ["future"], sampleNames: { future: "放假区间" } },
    dateSingle: { category: "日期信息", label: "单日假期", samples: ["single"] },
    dateReference: { category: "日期信息", label: "节日日期 · 安排待公布", samples: ["reference"] },
    dateEvent: { category: "日期信息", label: "自定义节日", samples: ["diy"] },
    upcoming: { category: "日期状态", label: "尚未开始", samples: ["future"] },
    starts: { category: "日期状态", label: "今天开始", samples: ["first"], targets: ["remaining", "variable-remaining"] },
    ongoing: { category: "日期状态", label: "进行中", samples: ["during"], targets: ["remaining", "variable-remaining"] },
    ends: { category: "日期状态", label: "今天结束", samples: ["last"], targets: ["remaining", "variable-remaining"] },
    onDay: { category: "日期状态", label: "节日当天", samples: ["single"], sampleNames: { single: "节日当天" }, targets: ["remaining", "variable-remaining"] },
    makeupDates: { category: "调休信息", label: "有调休", samples: ["future"], sampleNames: { future: "已知调休日期" } },
    makeupEmpty: { category: "调休信息", label: "无调休", samples: ["single"], sampleNames: { single: "无调休" } },
    makeupUnknown: { category: "调休信息", label: "安排待公布", samples: ["partial"] },
    todayHolidayText: { category: "今日内容", label: "今天放假", samples: ["first"], sampleNames: { first: "今天放假" }, targets: ["today"] },
    todayMakeupText: { category: "今日内容", label: "今天调休上班", samples: ["makeup"], targets: ["today"] },
    todayReferenceText: { category: "今日内容", label: "今天是节日 · 安排待公布", samples: ["referenceToday"] },
    todayEventText: { category: "今日内容", label: "今天是自定义节日", samples: ["diy"] },
    unknown: { category: "查询提示", label: "暂时无法获取信息", samples: ["unknown"], targets: ["next", "remaining"] },
    none: { category: "查询提示", label: "没有下个节日", samples: ["ordinary"], sampleNames: { ordinary: "没有下个节日" }, targets: ["next"] },
    noneRemaining: { category: "查询提示", label: "今年没有剩余节日", samples: ["ordinary"], sampleNames: { ordinary: "今年无剩余节日" }, targets: ["remaining"] },
};
export const copyEditor: CopyDeclaration = {
    id: "calendar", title: "日历文案", initial: "next", outputs,
    description: "换行写在整体文案中，条目间隔由模板末尾决定；修改对关联命令和变量生效，留空不输出", variablesId: "calendarCopyVariables",
    categoryParents: { 日期信息: "整体文案", 日期状态: "整体文案", 调休信息: "整体文案", 今日内容: "整体文案" },
    variableCompositions: fragmentCompositions, samples: calendarSamples(),
    fields: Object.fromEntries(Object.entries(branches).map(([key, branch]) => [key, {
        ...branch, path: ["calendarCopy", key], default: CALENDAR_COPY.text[key as keyof CalendarCopy],
        variables: Object.fromEntries(calendarCopyVariables[key as keyof CalendarCopy].map((name) => [name, itemVariables[name as keyof typeof itemVariables]])),
    }])),
    views: outputs.map((target) => {
        const keys: (keyof CalendarCopy)[] = target.id === "help" ? ["help"] : ["today", "eventToday"].includes(target.id)
            ? ["today", "todayHolidayText", "todayMakeupText", "todayReferenceText", "todayEventText"]
            : ["summary", "dateRange", "dateSingle", "dateReference", "dateEvent", "upcoming", "starts", "ongoing", "ends", "onDay", "makeupDates", "makeupEmpty", "makeupUnknown", "unknown", "none", "noneRemaining"];
        return { id: target.id, samples: target.id === "eventToday" ? ["diy", "multiple", "referenceToday"] : ["next", "variable-next"].includes(target.id) ? ["future", "single", "reference", "diy", "partial", "unknown", "ordinary"] : undefined, keys: keys.filter((key) => !branches[key].targets || branches[key].targets!.includes(target.id)), targets: [target.id] };
    }),
};
