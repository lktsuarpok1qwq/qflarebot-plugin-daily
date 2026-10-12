export const SOURCES = {
    gcores: { name: "机核", url: "https://www.gcores.com/rss", host: "www.gcores.com" },
    indienova: { name: "indienova", url: "https://indienova.com/feed/", host: "indienova.com" },
    yystv: { name: "游研社", url: "https://www.yystv.cn/rss/feed", host: "www.yystv.cn" },
    fivee: { name: "5EPlay", url: "https://csgo.5eplay.com/api/article?page=1&type_id=0&time=0&order_by=0", host: "csgo.5eplay.com" },
};
export type Source = keyof typeof SOURCES;
export const CATEGORIES = { announcement: "新作公布", release: "游戏发售", update: "大型更新", steam: "Steam 动态", esports: "电竞动态" };
export type Category = keyof typeof CATEGORIES;
export type Article = { title: string; url: string; published: number; category: string };
export type News = Article & { source: Source; game: string; kind: Category | ""; priority: number };
export type Cache = { source: Source; items: string; checked: number; succeeded: number; etag: string; modified: string; error: string };
export type Mode = "今日" | "订阅" | "发现" | "最新";
export type NewsDocument = { kind: "help" | "empty" | "unavailable" | "invalid" | "outOfRange" } | {
    kind: "list"; date: string; mode: Mode; page: number; pages: number;
    groups: { key: "subscribed" | "discovery" | "latest"; items: { title: string; url: string; source: string; time: string; game: string; category: string }[] }[];
};
