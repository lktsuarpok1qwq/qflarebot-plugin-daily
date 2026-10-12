import { decode, rssItems } from "./rss.js";
import { readText } from "../../shared/json.js";
import { SOURCES, type Source, type Article } from "./types.js";
export function canonicalUrl(value: unknown, source: Source): string {
    if (typeof value !== "string" || !value.trim() || value.length > 4096) { throw new Error("文章链接无效"); }

    const url = new URL(value, SOURCES[source].url);

    if (!['https:', 'http:'].includes(url.protocol) || url.hostname !== SOURCES[source].host || url.username || url.password || url.port) { throw new Error("文章链接来源无效"); }

    url.protocol = "https:";
    url.hash = "";

    for (const key of [...url.searchParams.keys()]) {
        if (/^utm_/i.test(key) || /^(spm|from)$/i.test(key)) { url.searchParams.delete(key); }
    }

    return url.href;
}
function article(source: Source, title: unknown, link: unknown, date: number, category: unknown): Article | undefined {
    if (typeof title !== "string" || !title.trim() || title.length > 1000 || !Number.isFinite(date) || date <= 0 || date > 8_640_000_000_000_000) { return; }

    try {
        return { title: title.replace(/\s+/g, " ").trim(), url: canonicalUrl(link, source), published: date, category: typeof category === "string" ? category.slice(0, 200) : "" };
    } catch { return; }
}
export function parseFeed(source: Source, text: string): Article[] {
    if (source === "fivee") {
        const response = JSON.parse(text) as { success?: boolean; data?: { list?: Record<string, unknown>[] } };

        if (response.success !== true || !Array.isArray(response.data?.list)) { throw new Error("5EPlay 返回格式错误"); }

        const rows = response.data.list.slice(0, 200);
        const items = rows.filter((r) => r && typeof r === "object" && !Array.isArray(r)).map((r) => article(source, typeof r.title === "string" ? decode(r.title) : r.title, r.jump_link, Number(r.dateline) * 1000, "")).filter((v): v is Article => !!v);

        if (rows.length && !items.length) { throw new Error("5EPlay 没有可解析的新闻"); }

        return items;
    }

    const rows = rssItems(text);
    const items = rows.map((row) => article(source, row.title, row.link, Date.parse(row.date), row.category)).filter((v): v is Article => !!v);

    if (rows.length && !items.length) { throw new Error("RSS 没有可解析的新闻"); }

    return items;
}
export async function fetchSource(source: Source, headers: { etag: string; modified: string }, request: typeof fetch = fetch) {
    const response = await request(SOURCES[source].url, {
        redirect: "manual", signal: AbortSignal.timeout(8000), headers: {
            accept: source === "fivee" ? "application/json" : "application/rss+xml, application/xml, text/xml",
            ...(headers.etag ? { "if-none-match": headers.etag } : {}), ...(headers.modified ? { "if-modified-since": headers.modified } : {}),
        }
    });

    if (response.status === 304) { await response.body?.cancel(); return { unchanged: true as const }; }

    if (!response.ok) { await response.body?.cancel(); throw new Error("新闻源 HTTP " + response.status); }

    const items = parseFeed(source, await readText(response, 1_000_000, "新闻源"));
    return { unchanged: false as const, items, etag: response.headers.get("etag") ?? "", modified: response.headers.get("last-modified") ?? "" };
}
