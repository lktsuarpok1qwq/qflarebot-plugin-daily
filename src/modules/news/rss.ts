export function decode(value: string): string {
    return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, entity: string) => {
        if (entity.startsWith("#")) {
            const code = entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
            return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : "";
        }

        return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " } as Record<string, string>)[entity.toLowerCase()] ?? whole;
    });
}

export function rssItems(text: string) {
    if (!/<rss\b/i.test(text) || !/<\/rss\s*>/i.test(text) || !/<channel\b/i.test(text) || /<!DOCTYPE|<!ENTITY/i.test(text)) { throw new Error("新闻源不是有效 RSS"); }

    const field = (block: string, tag: string) => {
        const value = block.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + "\\s*>", "i"))?.[1] ?? "";
        return decode(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim());
    };
    const blocks = [...text.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item\s*>/gi)];

    if (/<item\b/i.test(text) && !blocks.length) { throw new Error("RSS 没有可解析的新闻"); }

    return blocks.map((match) => ({ title: field(match[1]!, "title"), link: field(match[1]!, "link"), date: field(match[1]!, "pubDate"), category: field(match[1]!, "category"), source: field(match[1]!, "(?:[a-z0-9_-]+:)?source") }));
}
