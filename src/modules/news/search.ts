import { readText } from "../../shared/json.js";
import { expand } from "../../shared/interpolation.js";
import { rssItems } from "./rss.js";
import type { SearchCopy } from "./copy.js";
export type SearchItem = { title: string; url: string; source: string; time: string };
export type SearchDocument = { kind: "usage" | "empty"; query: string } | { kind: "list"; query: string; items: SearchItem[] };
export function parseSearch(text: string): SearchItem[] {
    const rows = rssItems(text), items: SearchItem[] = [], urls = new Set<string>(), titles = new Set<string>();
    let valid = 0;

    for (const row of rows) {
        try {
            const title = row.title.replace(/\s+/g, " ").trim();
            let url = new URL(row.link);

            if (url.hostname === "www.bing.com" && url.pathname === "/news/apiclick.aspx") { url = new URL(url.searchParams.get("url") ?? ""); }

            if (!title || title.length > 1000 || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.href.length > 4096) { continue; }

            valid++;

            if (!/[\u3400-\u9fff]/.test(title)) { continue; }

            url.hash = "";

            for (const key of [...url.searchParams.keys()]) {
                if (/^utm_/i.test(key)) { url.searchParams.delete(key); }
            }

            const titleKey = title.toLowerCase().replace(/[\s\p{P}]/gu, "");

            if (urls.has(url.href) || titles.has(titleKey)) { continue; }

            urls.add(url.href); titles.add(titleKey);
            const date = Date.parse(row.date);
            items.push({ title, url: url.href, source: row.source || url.hostname, time: Number.isFinite(date) ? new Date(date + 8 * 3600000).toISOString().slice(5, 16).replace("T", " ") : "" });
        } catch { continue; }
    }

    if (rows.length && !valid) { throw new Error("Bing 新闻没有可解析的条目"); }

    return items;
}
export async function searchNews(query: string, request: typeof fetch = fetch): Promise<SearchDocument> {
    const url = new URL("https://www.bing.com/news/search");
    url.searchParams.set("q", query); url.searchParams.set("format", "rss");
    const response = await request(url, { redirect: "manual", signal: AbortSignal.timeout(8000), headers: { accept: "application/rss+xml, application/xml, text/xml" } });

    if (!response.ok) { await response.body?.cancel(); throw new Error("Bing 新闻 HTTP " + response.status); }

    const items = parseSearch(await readText(response, 256_000, "新闻搜索响应"));
    return items.length ? { kind: "list", query, items } : { kind: "empty", query };
}
export function renderSearch(copy: SearchCopy, document: SearchDocument, interpolate: typeof expand, decorate?: (key: keyof SearchCopy, text: string) => string) {
    if (document.kind !== "list") {
        const text = interpolate(copy[document.kind], { query: document.query });
        return decorate ? decorate(document.kind, text) : text;
    }

    let items = "";

    if (copy.body.includes("{{results}}")) {
        for (const [index, item] of document.items.entries()) {
            const url = item.url.replace(/[\s()<>\\]/g, (c) => encodeURIComponent(c).replace(/\(/g, "%28").replace(/\)/g, "%29"));
            const text = interpolate(copy.item, { ...item, index: String(index + 1) }, { url });
            items += decorate ? decorate("item", text) : text;
        }
    }

    const text = interpolate(copy.body, { query: document.query }, { results: items });
    return decorate ? decorate("body", text) : text;
}
export async function querySearch(copy: SearchCopy, args: string[], request: typeof fetch = fetch) {
    const query = args.join(" ").trim();

    if (!query) { return { text: renderSearch(copy, { kind: "usage", query }, expand) }; }

    if (!copy.body.includes("{{results}}") || !copy.item) { return { text: renderSearch(copy, { kind: "list", query, items: [] }, expand) }; }

    return { text: renderSearch(copy, await searchNews(query, request), expand) };
}
