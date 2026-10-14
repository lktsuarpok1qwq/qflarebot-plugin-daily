import { commandLink } from "../../shared/interpolation.js";
export const FORTUNE_CARD_COPY = {
    drawCaption: commandLink("📜 点击解签", "/运势 解"),
    needDraw: "🎲 今天还没有抽签，" + commandLink("先抽一签", "/运势 抽"),
    detailCaption: "仅供娱乐",
};

export const FORTUNE_COPY = {
    ...FORTUNE_CARD_COPY,
    drawText: "🔮 **{{title}}**\n\n{{level}} · {{score}} 分 · {{rarity}}\n📅 {{date}}\n\n{{sign}}\n\n" + commandLink("📜 点击解签", "/运势 解"),
    detailText: "📜 **{{title}} · 解签**\n\n{{level}} · {{score}} 分 · {{rarity}}\n📅 {{date}}\n\n{{sign}}\n\n🔍 {{explanation}}\n\n✅ 宜：{{good1}}、{{good2}}\n🚫 忌：{{bad1}}、{{bad2}}\n\n✨ {{effect}}：{{effect_text}}\n🎁 {{item}}：{{item_text}}\n\n{{egg}}\n\n仅供娱乐",
    help: "🔮 **今日运势**\n\n看看今天的专属签文，同一天结果固定\n\n" + commandLink("🎲 抽取运势", "/运势 抽") + " · " + commandLink("📜 解签", "/运势 解") + "\n\n仅供娱乐",
    noIdentity: "🙈 暂时无法识别你的身份，请重新发送命令",
    unavailable: "📭 运势暂不可用，稍后再来看看",
    level_great: "大吉", level_good: "中吉", level_small: "小吉", level_neutral: "小凶", level_bad: "中凶", level_worst: "大凶",
    rarity_common: "普通", rarity_rare: "稀有", rarity_epic: "史诗", rarity_legendary: "传说",
};
export type FortuneCopy = typeof FORTUNE_COPY;
export const LEVEL_NAMES = { great: "大吉", good: "中吉", small: "小吉", neutral: "小凶", bad: "中凶", worst: "大凶" };
export const RARITY_NAMES = { common: "普通", rare: "稀有", epic: "史诗", legendary: "传说" };
export const FORTUNE_CARD_HEADINGS = { small: "今日签", detail: "今日解签", explanation: "解签", good: "宜", bad: "忌", effect: "今日效果", item: "幸运物", egg: "隐藏彩蛋" };
export const FORTUNE_CARD_LABELS = { levels: LEVEL_NAMES, rarities: RARITY_NAMES };
export const THEME_NAMES = { absurd: "抽象荒诞", gaming: "二次元＋CS", daily: "日常生活", student: "学生", mystic: "轻玄学" };

export const FORTUNE_TEXT_VARIABLES = { title: "签名", date: "抽签日期", level: "吉凶", score: "分数", rarity: "稀有度", sign: "签文" };
export const FORTUNE_DETAIL_VARIABLES = { ...FORTUNE_TEXT_VARIABLES, explanation: "解签", good1: "宜第一项", good2: "宜第二项", bad1: "忌第一项", bad2: "忌第二项", effect: "效果名称", effect_text: "效果说明", item: "幸运物", item_text: "幸运物说明", egg: "彩蛋，没有时为空" };
