import { validDate } from "../../../shared/date.js";
import type { TextRun, RenderElement, T2IRequest } from "../../../shared/t2i/index.js";
import { LEVELS, RARITIES } from "../types.js";
import { CARD_THEMES, CARD_LIMITS, CARD_PALETTES, CARD_SIZES, cardRegions } from "./layout.js";
import type { CardPhrase, FortuneCardContent, FortuneCardLabels } from "./types.js";

function checkText(text: string, limit: number, name: string, lines = 1) {
    if (!text.trim() || Array.from(text.replaceAll("\n", "")).length > limit || text.split("\n").length > lines || /[\r\t]/.test(text)) {
        throw new Error(`${name}超出卡面文字约束`);
    }
}

function validate(content: FortuneCardContent, labels: FortuneCardLabels) {
    if (!CARD_THEMES.includes(content.theme) || !validDate(content.date) || !Object.hasOwn(LEVELS, content.level) || !RARITIES.includes(content.rarity)) {
        throw new Error("卡面分类或日期无效");
    }

    const [min, max] = LEVELS[content.level];

    if (!Number.isInteger(content.score) || content.score < min || content.score > max || !content.icon.trim()) {
        throw new Error("卡面分数或图标无效");
    }

    checkText(content.title, CARD_LIMITS.title, "签名");
    checkText(content.sign.text, CARD_LIMITS.sign, "签文", 2);
    checkText(content.explanation.text, CARD_LIMITS.explanation, "解签", 2);

    for (const actions of [content.good, content.bad]) {
        if (actions.length !== 2) { throw new Error("宜忌各需要两条"); }

        for (const action of actions) { checkText(action, CARD_LIMITS.action, "宜忌"); }
    }

    for (const detail of [content.effect, content.item]) {
        checkText(detail.name, CARD_LIMITS.name, "效果或幸运物名称");
        checkText(detail.description.text, CARD_LIMITS.description, "效果或幸运物说明", 2);
    }

    if (content.egg) { checkText(content.egg.text, CARD_LIMITS.egg, "彩蛋", 2); }

    checkText(labels.levels[content.level], 2, "吉凶名称");
    checkText(labels.rarities[content.rarity], 6, "稀有度名称");
}

function runs(phrase: CardPhrase, color: string): TextRun[] {
    const matches: { start: number; end: number }[] = [];

    for (const word of phrase.emphasis ?? []) {
        if (!word || !phrase.text.includes(word)) { throw new Error("重点词必须出现在对应文案中"); }

        let offset = 0;

        while ((offset = phrase.text.indexOf(word, offset)) !== -1) {
            matches.push({ start: offset, end: offset + word.length });
            offset += word.length;
        }
    }

    const result: TextRun[] = [];
    let offset = 0;

    for (const match of matches.sort((a, b) => a.start - b.start)) {
        if (match.end <= offset) { continue; }

        if (match.start > offset) { result.push({ text: phrase.text.slice(offset, match.start) }); }

        result.push({ text: phrase.text.slice(Math.max(offset, match.start), match.end), color });
        offset = match.end;
    }

    if (offset < phrase.text.length) { result.push({ text: phrase.text.slice(offset) }); }

    return result;
}

/** 只生成卡面请求，不读取配置、语料、网络或数据库 */
export function fortuneCardRequest(content: FortuneCardContent, view: "small" | "detail", labels: FortuneCardLabels): T2IRequest {
    validate(content, labels);
    const layout = view === "small" ? "small" : content.egg ? "egg" : "detail";
    const regions = cardRegions(layout), colors = CARD_PALETTES[content.theme], elements: RenderElement[] = [];
    const text = (region: string, value: string | CardPhrase, size: number, y = 0, color: string = colors.text, x = 2, weight: 400 | 700 = 400) => {
        elements.push({
            type: "text", region, x, y, size, weight, color, maxWidth: regions[region]!.width - x - 2, lineHeight: size === 40 ? 48 : size === 28 ? 36 : 30,
            ...(typeof value === "string" ? { text: value } : { runs: runs(value, colors.accent) })
        });
    };

    for (const [region, value] of [["month", content.date.slice(5, 7)], ["day", content.date.slice(8)]] as const) {
        elements.push({ type: "text", region, text: String(Number(value)), x: 35, y: 0, size: CARD_SIZES.secondary, align: "right", color: colors.muted });
    }

    text("title", content.title, CARD_SIZES.title, 0, colors.text, 2, 700);
    elements.push({ type: "emoji", region: "icon", value: content.icon, x: 0, y: 0, size: CARD_SIZES.icon });
    elements.push({ type: "text", region: "result", text: labels.levels[content.level], x: 64, y: 12, size: CARD_SIZES.title, weight: 700, align: "center", color: LEVELS[content.level][0] >= 55 ? colors.good : colors.bad });
    elements.push({ type: "text", region: "score", text: String(content.score), x: 49, y: 0, size: CARD_SIZES.secondary, align: "right", color: colors.text });
    text("sign", content.sign, CARD_SIZES.body);
    text("rarity", labels.rarities[content.rarity], CARD_SIZES.secondary, 2, colors.rarity);

    if (view === "detail") {
        text("explanation", content.explanation, CARD_SIZES.body);

        for (const key of ["good", "bad"] as const) {
            text(key, content[key][0]!, CARD_SIZES.body);
            text(key, content[key][1]!, CARD_SIZES.body, 36);
        }

        for (const key of ["effect", "item"] as const) {
            text(key, content[key].name, CARD_SIZES.body, 0, colors.accent);
            text(key, content[key].description, CARD_SIZES.secondary, 40);
        }

        if (content.egg) {
            text("egg", content.egg, CARD_SIZES.secondary);
        }
    }

    return { background: `fortune-${content.theme}-${layout}`, elements };
}
