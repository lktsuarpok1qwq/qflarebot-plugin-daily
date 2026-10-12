import { copyContract } from "./definition.js";
import { NEWS_COPY, SEARCH_COPY } from "./copy.js";
import { SOURCES, CATEGORIES } from "./types.js";
import { fields } from "../../shared/validation.js";
import { BODY_BYTES } from "../../shared/types.js";
export type NewsConfig = { schemaVersion: 1; total: number; discovery: number; subscriptions: string; exclude: string; copy: typeof NEWS_COPY; search: typeof SEARCH_COPY } & Record<keyof typeof SOURCES | keyof typeof CATEGORIES, boolean>;
export function subscriptions(text: string) {
    return text.split(/[;；\n]/).filter((s) => s.trim()).map((s) => {
        const aliases = s.split(/[,，|]/).map((v) => v.trim()).filter(Boolean);
        return { name: aliases[0] ?? "", aliases };
    });
}
export function defaults(): NewsConfig {
    return copyContract.defaults({ schemaVersion: 1 as const, total: 8, discovery: 2, subscriptions: "CS2,CSGO,反恐精英,Counter-Strike；塔科夫,逃离塔科夫,Tarkov,EFT", exclude: "", gcores: true, indienova: true, yystv: true, fivee: true, announcement: true, release: true, update: true, steam: true, esports: true });
}
export function validate(value: unknown, shapeOnly = false): NewsConfig {
    const c = value as NewsConfig;

    if (!c || typeof c !== "object" || Array.isArray(c) || c.schemaVersion !== 1) { throw new Error("新闻配置格式错误"); }

    fields(c, ["schemaVersion", "total", "discovery", "subscriptions", "exclude", "copy", "search", ...Object.keys(SOURCES), ...Object.keys(CATEGORIES)]);

    for (const key of [...Object.keys(SOURCES), ...Object.keys(CATEGORIES)] as (keyof typeof SOURCES | keyof typeof CATEGORIES)[]) {
        if (typeof c[key] !== "boolean") { throw new Error("来源和新闻类型必须为开关"); }
    }

    if (!Number.isSafeInteger(c.total) || c.total < 1 || c.total > 400 || !Number.isSafeInteger(c.discovery) || c.discovery < 0 || c.discovery > c.total) { throw new Error("每页条数须为 1～400，发现预留不能超过每页条数"); }

    if (typeof c.subscriptions !== "string" || c.subscriptions.length > 4000 || typeof c.exclude !== "string" || c.exclude.length > 2000) { throw new Error("订阅或排除关键词格式错误或过长"); }

    const games = subscriptions(c.subscriptions);

    if (games.length > 50 || games.some((g) => !g.name || g.aliases.some((a) => a.length < 2 || a.length > 80)) || new Set(games.map((g) => g.name.toLowerCase())).size !== games.length) { throw new Error("最多订阅 50 个游戏，名称不能重复，每个名称或别名须为 2～80 个字符"); }

    // Search copy is optional in storage; omitted customization uses the declared defaults.
    const config = { ...c, search: c.search === undefined ? { ...SEARCH_COPY } : c.search };
    copyContract.validate(config, shapeOnly);

    if (!shapeOnly && new TextEncoder().encode(JSON.stringify(c)).length > BODY_BYTES) { throw new Error("新闻配置总量超限"); }

    return config;
}
export function parseConfig(raw: string) { return validate(JSON.parse(raw), true); }
