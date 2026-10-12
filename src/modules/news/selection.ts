import { addDays, at, dateAt } from "../../shared/date.js";
import { subscriptions, type NewsConfig } from "./config.js";
import { CATEGORIES, SOURCES, type Source, type Article, type Cache, type News, type Mode, type Category, type NewsDocument } from "./types.js";
export const CACHE_LIMIT = 100;
export const cutoff = (now: number) => at(addDays(dateAt(now), -2), "00:00");
export function mergeArticles(old: Article[], incoming: Article[], now: number): Article[] {
    const start = cutoff(now);
    const items = new Map(old.map((item) => [item.url, item]));

    for (const item of incoming) { items.set(item.url, item); }

    return [...items.values()].filter((item) => item.published >= start && item.published <= now).sort((a, b) => b.published - a.published || a.url.localeCompare(b.url)).slice(0, CACHE_LIMIT);
}
function matcher(alias: string): (text: string) => boolean {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp((/[\u3400-\u9fff]/.test(alias) ? escaped : "(?:^|[^a-z0-9])" + escaped + "(?:$|[^a-z0-9])"), "i");
    return (text) => expression.test(text);
}
export function classify(article: Article, source: Source): { kind: Category | ""; rejected: string } {
    const title = article.title;
    const cs = /\b(?:cs\s*2|cs\s*:?\s*go|counter[ -]?strike|hltv)\b|反恐精英|EPL\s*S?\d|IEM\s+|BLAST\s+(?:Premier|Rivals|Open|Bounty)/i.test(title);

    const roundup = /Steam.*(?:销量|热销|游戏节|新品节)|游戏(?:周报|汇总)|一周游戏汇/i.test(title);

    if (source !== "fivee" && cs && !roundup) { return { kind: "", rejected: "CS 资讯仅使用 5EPlay" }; }

    if (!/[\u3400-\u9fff]/.test(title)) { return { kind: "", rejected: "非中文标题" }; }

    if (/抽奖|返利|优惠券|福利|核聚变|播客|夜话|录音笔|告解室|核吃海塞|教程|广告|赞助商/i.test(title + " " + article.category)) { return { kind: "", rejected: "推广或非新闻内容" }; }

    if (/修复|热修|小补丁|bug\s*fix/i.test(title) && !/大型|重大|资料片|新地图|新玩法|DLC/i.test(title)) { return { kind: "", rejected: "日常修复" }; }

    if (source === "fivee") {
        if (/夺冠|冠军|转会|加盟|签约|离队|退役|阵容|换人|重组|解散|加入|替补|停赛|禁赛/i.test(title) && !/采访|访谈|[：:]|Rating|MVP/i.test(title)) { return { kind: "esports", rejected: "" }; }

        if (/采访|访谈|[：:]|战报|比分|险胜|击败|战胜|淘汰|晋级|Rating|MVP/i.test(title)) { return { kind: "", rejected: "普通战报或访谈" }; }
    }

    if (/\bSteam\b/i.test(title) && /平台|政策|功能|活动|促销|特卖|游戏节|新品节|销量榜|同时在线/i.test(title)) { return { kind: "steam", rejected: "" }; }

    if (/资料片|\bDLC\b|大型更新|重大更新|新地图|新玩法|拓展包|扩展包|新赛季|大版本/i.test(title)) { return { kind: "update", rejected: "" }; }

    if (/发售|上市|上线|发行日期|跳票|延期/i.test(title)) { return { kind: "release", rejected: "" }; }

    if (/新作|首曝|公布|公开|亮相|预告|玩法展示|新游/i.test(title)) { return { kind: "announcement", rejected: "" }; }

    return { kind: "", rejected: "" };
}
export function createEvaluator(config: NewsConfig) {
    const games = subscriptions(config.subscriptions).map((game) => ({ ...game, matches: game.aliases.map(matcher), cs: game.aliases.some((a) => /^(cs2|csgo|反恐精英|counter-strike)$/i.test(a)) }));
    const excluded = config.exclude.split(/[,，;；\n]/).map((v) => v.trim()).filter(Boolean).map(matcher);
    return (article: Article, source: Source): News & { rejected: string } => {
        const matched = games.findIndex((game) => game.matches.some((match) => match(article.title)));
        const index = matched >= 0 ? matched : source === "fivee" ? games.findIndex((game) => game.cs) : -1;
        const { kind, rejected } = classify(article, source);
        return {
            ...article, source, game: games[index]?.name ?? "", priority: index < 0 ? Number.MAX_SAFE_INTEGER : index, kind,
            rejected: !config[source] ? "来源已停用" : rejected || (excluded.some((match) => match(article.title)) ? "排除关键词" : kind && !config[kind] ? "未启用的新闻类型" : index < 0 && !kind ? "发现未识别出保留类型" : "")
        };
    };
}
export function candidates(cache: Cache[], config: NewsConfig, now: number): News[] {
    const evaluate = createEvaluator(config), start = cutoff(now);
    const items = cache.filter((row) => config[row.source]).flatMap((row) => (JSON.parse(row.items) as Article[]).filter((item) => item.published >= start && item.published <= now).map((item) => evaluate(item, row.source))).filter((item) => !item.rejected);
    items.sort((a, b) => b.published - a.published || a.url.localeCompare(b.url));
    const seen = new Set<string>();
    return items.filter((item) => {
        const key = item.title.toLowerCase().replace(/[\s\p{P}]/gu, "");

        if (seen.has(key)) { return false; }

        seen.add(key);
        return true;
    });
}
export function document(config: NewsConfig, cache: Cache[], mode: Mode, page: number, now: number): NewsDocument {
    let items = candidates(cache, config, now);
    const today = dateAt(now);

    if (mode !== "最新") { items = items.filter((item) => dateAt(item.published) === today); }

    if (mode === "订阅") { items = items.filter((item) => item.game); }

    if (mode === "发现") { items = items.filter((item) => !item.game); }

    if (!items.length) {
        const enabled = cache.filter((row) => config[row.source]);
        const unavailable = Object.keys(SOURCES).some((source) => config[source as Source]) && (!enabled.length || enabled.some((row) => row.error || row.succeeded < at(today, "00:00")));
        return { kind: unavailable ? "unavailable" : "empty" };
    }

    const latest = (a: News, b: News) => b.published - a.published || a.url.localeCompare(b.url);
    const subscribed = mode === "今日" || mode === "订阅" ? items.filter((item) => item.game).sort((a, b) => a.priority - b.priority || Number(!!b.kind) - Number(!!a.kind) || latest(a, b)) : [];
    const discovery = mode === "今日" ? items.filter((item) => !item.game) : [];
    const pages: News[][] = [];

    if (mode === "今日") {
        let si = 0, di = 0;

        while (si < subscribed.length || di < discovery.length) {
            const s = subscribed.slice(si, si + config.total - config.discovery), d = discovery.slice(di, di + config.discovery);
            si += s.length; di += d.length;
            const extraS = subscribed.slice(si, si + config.total - s.length - d.length);
            s.push(...extraS); si += extraS.length;
            const extraD = discovery.slice(di, di + config.total - s.length - d.length);
            d.push(...extraD); di += extraD.length;
            pages.push([...s, ...d]);
        }
    } else {
        const ordered = mode === "订阅" ? subscribed : items;

        for (let i = 0; i < ordered.length; i += config.total) { pages.push(ordered.slice(i, i + config.total)); }
    }

    const selected = pages[page - 1];

    if (!selected) { return { kind: "outOfRange" }; }

    const groupKeys = mode === "最新" ? ["latest"] as const : ["subscribed", "discovery"] as const;
    const groups = groupKeys.map((key) => ({ key, items: selected.filter((item) => key === "latest" || (key === "subscribed" ? !!item.game : !item.game)).map((item) => ({ title: item.title, url: item.url, source: SOURCES[item.source].name, time: new Date(item.published + 8 * 3_600_000).toISOString().slice(5, 16).replace("T", " "), game: item.game, category: item.kind ? CATEGORIES[item.kind] : "" })) })).filter((group) => group.items.length);
    return { kind: "list", date: today, mode, page, pages: pages.length, groups };
}
