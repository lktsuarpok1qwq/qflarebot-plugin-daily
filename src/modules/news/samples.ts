import type { NewsDocument } from "./types.js";
const item = { title: "CS2 公布全新地图与玩法", url: "https://csgo.5eplay.com/article/example", source: "5EPlay", time: "10-12 09:00", game: "CS2", category: "大型更新" };
export const normalSample: NewsDocument = {
    kind: "list", date: "2026-10-12", mode: "今日", page: 2, pages: 3, groups: [
        { key: "subscribed", items: [item, { ...item, title: "《逃离塔科夫》大型更新公布", url: "https://www.gcores.com/articles/example", source: "机核", game: "塔科夫" }] },
        { key: "discovery", items: [{ ...item, title: "独立新作公布发售日期", url: "https://indienova.com/indie-news/example/", source: "indienova", game: "", category: "游戏发售" }] },
    ]
};
export const samples = [
    { id: "normal", name: "新闻列表与翻页", document: normalSample },
    ...(["help", "empty", "unavailable", "invalid", "outOfRange"] as const).map((kind) => ({ id: kind, name: ({ help: "无特殊情景", empty: "无合格新闻", unavailable: "无特殊情景", invalid: "页码无效", outOfRange: "超出末页" })[kind], document: { kind } as NewsDocument })),
];

export const searchSamples = [
    {
        id: "search-list", name: "多条搜索结果", search: {
            kind: "list" as const, query: "人工智能", items: [
                { title: "人工智能应用研讨会举行", url: "https://example.com/news/ai", source: "科技日报", time: "10-12 09:00" },
                { title: "人工智能产业发展报告发布", url: "https://example.com/news/report", source: "新华网", time: "10-12 08:30" },
            ]
        }
    },
    { id: "search-empty", name: "没有搜索结果", search: { kind: "empty" as const, query: "人工智能" } },
    { id: "search-usage", name: "未填写关键词", search: { kind: "usage" as const, query: "" } },
];
