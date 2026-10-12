import { createCopyContract } from "../../shared/copy-contract.js";
import { outputTargets, type CopyDeclaration, type CopyField, type SettingsDeclaration } from "../../shared/declarations.js";
import { NEWS_COPY, SEARCH_COPY, SEARCH_FIELDS, ITEM_FIELDS, newsVariables, type NewsCopy, type SearchCopy } from "./copy.js";
import { SOURCES, CATEGORIES } from "./types.js";
import { samples, searchSamples } from "./samples.js";
export const commands = [
    { name: "新闻", description: "新闻帮助" }, { name: "新闻 搜", description: "搜索中文新闻" },
    { name: "新闻 游戏", description: "今日游戏简报，可加页码" },
    ...["订阅", "发现", "最新"].map((name) => ({ name: "新闻 游戏 " + name, description: "查看" + name + "游戏新闻，可加页码" })),
];
const fields: Record<keyof NewsCopy, { label: string; category: string; samples: string[]; variables: Record<string, string> }> = {
    help: { label: "帮助正文", category: "帮助", samples: ["help"], variables: {} },
    body: { label: "列表正文", category: "整体文案", samples: ["normal"], variables: { date: "当天日期", mode: "查询范围", page: "当前页码", pages: "总页数", groups: "按分组格式展开的新闻", navigation: "翻页文案，只有一页时为空" } },
    subscribed: { label: "订阅资讯", category: "新闻分组", samples: ["normal"], variables: { items: "当前分组的新闻条目" } },
    discovery: { label: "发现", category: "新闻分组", samples: ["normal"], variables: { items: "当前分组的新闻条目" } },
    latest: { label: "最近三天", category: "新闻分组", samples: ["normal"], variables: { items: "最近三天的新闻条目" } },
    item: { label: "新闻条目", category: "条目格式", samples: ["normal"], variables: ITEM_FIELDS },
    navigation: { label: "翻页栏", category: "翻页", samples: ["normal"], variables: { page: "当前页码", pages: "总页数", previous: "上一页链接，首页时为空", next: "下一页链接，末页时为空" } },
    previous: { label: "上一页", category: "翻页链接", samples: ["normal"], variables: { url: "上一页命令链接", page: "上一页页码" } },
    next: { label: "下一页", category: "翻页链接", samples: ["normal"], variables: { url: "下一页命令链接", page: "下一页页码" } },
    empty: { label: "没有新闻", category: "查询提示", samples: ["empty"], variables: {} },
    unavailable: { label: "暂时无法获取", category: "查询提示", samples: ["unavailable"], variables: {} },
    invalid: { label: "页码无效", category: "查询提示", samples: ["invalid"], variables: {} },
    outOfRange: { label: "超出末页", category: "查询提示", samples: ["outOfRange"], variables: {} },
};
const searchFields: Record<keyof SearchCopy, { label: string; category: string; samples: string[]; variables: Record<string, string> }> = {
    body: { label: "搜索正文", category: "搜索结果", samples: ["search-list"], variables: { query: "搜索关键词", results: "本次新闻条目" } },
    item: { label: "新闻条目", category: "搜索条目", samples: ["search-list"], variables: SEARCH_FIELDS },
    empty: { label: "没有结果", category: "查询提示", samples: ["search-empty"], variables: { query: "搜索关键词" } },
    usage: { label: "填写关键词", category: "查询提示", samples: ["search-usage"], variables: {} },
};
const lists = ["body", "item", "navigation", "previous", "next", "empty", "unavailable", "invalid", "outOfRange"];
const declaration: CopyDeclaration = {
    id: "news", title: "新闻文案", initial: "today",
    description: "共用字段同步影响关联命令与变量，预览仅使用本地样例",
    outputs: outputTargets([{ id: "search", command: "新闻 搜", suffix: " <关键词>" }, { id: "help", command: "新闻" }, { id: "today", command: "新闻 游戏" }, { id: "subscribed", command: "新闻 游戏 订阅" }, { id: "discovery", command: "新闻 游戏 发现" }, { id: "latest", command: "新闻 游戏 最新" }, { id: "variable", variable: newsVariables.variables[0]! }]),
    categoryParents: { 搜索条目: "搜索结果", 新闻分组: "整体文案", 条目格式: "新闻分组", 翻页: "整体文案", 翻页链接: "翻页" },
    variableCompositions: { results: { description: "搜索条目", scope: "搜索条目", fields: SEARCH_FIELDS }, groups: { description: "新闻分组", scope: "新闻分组和条目格式", fields: { items: "当前分组的条目", ...ITEM_FIELDS } }, items: { description: "新闻条目", scope: "条目格式", fields: ITEM_FIELDS }, navigation: { description: "翻页栏", scope: "翻页和翻页链接", fields: fields.navigation.variables } },
    samples: [...samples, ...searchSamples],
    fields: {
        ...Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, { ...field, path: ["copy", key], default: NEWS_COPY[key as keyof NewsCopy], allowEmpty: true, ...(["previous", "empty", "unavailable", "invalid", "outOfRange"].includes(key) ? { targets: ["today", "subscribed", "discovery", "latest"] } : {}) }])) satisfies Record<string, CopyField>,
        ...Object.fromEntries(Object.entries(SEARCH_COPY).map(([key, value]) => ["search" + key, { path: ["search", key], default: value, allowEmpty: true, targets: ["search"], ...searchFields[key as keyof SearchCopy] }]))
    },
    views: [
        { id: "search", keys: Object.keys(SEARCH_COPY).map((key) => "search" + key), targets: ["search"] },
        { id: "help", keys: ["help"], targets: ["help"] },
        { id: "today", keys: ["body", "subscribed", "discovery", ...lists.slice(1)], targets: ["today", "variable"] },
        { id: "subscribed", keys: ["body", "subscribed", ...lists.slice(1)], targets: ["subscribed"] },
        { id: "discovery", keys: ["body", "discovery", ...lists.slice(1)], targets: ["discovery"] },
        { id: "latest", keys: ["body", "latest", ...lists.slice(1)], targets: ["latest"] },
    ],
};
export const copyContract = createCopyContract<{ copy: NewsCopy; search: SearchCopy }>(declaration);
export const settings: SettingsDeclaration = {
    id: "news-settings", title: "游戏新闻设置", description: "每小时采集，保留今天及前两天，每个来源最多 100 条；CS 资讯仅使用 5EPlay，标题无法识别的内容可能漏筛",
    fields: [
        ...Object.entries(SOURCES).map(([key, source]) => ({ key, id: "news-" + key, label: source.name, type: "checkbox" as const })),
        { key: "total", id: "news-total", label: "每页总条数", type: "number" },
        { key: "discovery", id: "news-discovery", label: "发现预留", type: "number", hint: "用于今日简报，可设为 0；一方不足由另一方补足" },
        { key: "subscriptions", id: "news-subscriptions", label: "订阅游戏", type: "text", hint: "所有群共用，靠前优先；游戏之间用分号，名称与别名用逗号，如 CS2,反恐精英；塔科夫,Tarkov" },
        { key: "exclude", id: "news-exclude", label: "排除关键词", type: "text", hint: "用逗号分隔，留空不额外排除" },
        ...Object.entries(CATEGORIES).map(([key, label]) => ({ key, id: "news-" + key, label, type: "checkbox" as const })),
    ],
};
