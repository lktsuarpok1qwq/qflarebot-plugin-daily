import type { expand, commandUrl } from "../../shared/interpolation.js";
import type { NewsCopy } from "./copy.js";
import type { NewsDocument } from "./types.js";
/** Pure rendering shared by commands, variables and local editor samples. */
export function renderNews(copy: NewsCopy, document: NewsDocument, interpolate: typeof expand, link: typeof commandUrl, decorate?: (key: keyof NewsCopy, text: string) => string): string {
    if (document.kind !== "list") { return decorate ? decorate(document.kind, copy[document.kind]) : copy[document.kind]; }

    let index = 0, groups = "";

    for (const group of document.groups) {
        let items = "";

        for (const item of group.items) {
            const url = item.url.replace(/[\s()<>\\]/g, (c) => encodeURIComponent(c).replace(/\(/g, "%28").replace(/\)/g, "%29"));
            const text = interpolate(copy.item, { ...item, index: String(++index) }, { url });
            items += decorate ? decorate("item", text) : text;
        }

        const text = interpolate(copy[group.key], {}, { items });
        groups += decorate ? decorate(group.key, text) : text;
    }

    let navigation = "";

    if (document.pages > 1) {
        const links = { previous: "", next: "" };

        for (const key of ["previous", "next"] as const) {
            const page = document.page + (key === "previous" ? -1 : 1);

            if (page < 1 || page > document.pages) { continue; }

            const command = "/新闻 游戏" + (document.mode === "今日" ? "" : " " + document.mode) + " " + page;
            const url = link(command);
            const text = interpolate(copy[key], { page: String(page) }, { url });
            links[key] = decorate ? decorate(key, text) : text;
        }

        const text = interpolate(copy.navigation, { page: String(document.page), pages: String(document.pages) }, links);
        navigation = decorate ? decorate("navigation", text) : text;
    }

    const text = interpolate(copy.body, { date: document.date, page: String(document.page), pages: String(document.pages), mode: document.mode }, { groups, navigation });
    return decorate ? decorate("body", text) : text;
}
