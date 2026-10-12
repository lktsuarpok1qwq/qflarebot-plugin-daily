import { commandLink } from "../../shared/interpolation.js";
export const FORTUNE_COPY = {
    help: "🔮 **今日运势**\n\n看看今天的专属签文，同一天结果固定\n\n" + commandLink("🎲 抽取运势", "/运势 抽") + "\n\n仅供娱乐",
    body: "🔮 今日运势 · {{level}} {{score}}/100\n【{{title}}】 · {{rarity}}\n\n📜 {{sign}}\n{{explanation}}\n\n{{good}}\n{{bad}}\n{{effect}}\n{{item}}\n{{egg}}\n\n仅供娱乐",
    noIdentity: "🙈 暂时无法识别你的身份，请重新发送命令",
    unavailable: "📭 运势暂不可用，稍后再来看看",
    good: "✅ 宜：{{items}}", bad: "❌ 忌：{{items}}",
    actionFirst: "{{text}}", actionNext: " / {{text}}",
    effect: "✨ {{kind}}：{{name}}——{{description}}", buff: "Buff", debuff: "Debuff",
    item: "🍀 幸运物：{{name}} {{description}}", egg: "🎁 {{text}}",
    level_great: "大吉", level_good: "中吉", level_small: "小吉", level_neutral: "小凶", level_bad: "中凶", level_worst: "大凶",
    rarity_common: "普通", rarity_rare: "稀有", rarity_epic: "史诗", rarity_legendary: "传说",
};
export type FortuneCopy = typeof FORTUNE_COPY;
export const RESULT_FIELDS = { date: "抽取日期", level: "吉凶名称", score: "0–100 分", title: "主签标题", sign: "签文", explanation: "解签", rarity: "主签稀有度名称", good: "今日宜完整文案，无条目时为空", bad: "今日忌完整文案，无条目时为空", effect: "状态完整文案，无条目时为空", item: "幸运物完整文案，无条目时为空", egg: "彩蛋完整文案，未命中时为空" };
export const LEVEL_NAMES = { great: "大吉", good: "中吉", small: "小吉", neutral: "小凶", bad: "中凶", worst: "大凶" };
export const RARITY_NAMES = { common: "普通", rare: "稀有", epic: "史诗", legendary: "传说" };
export const THEME_NAMES = { absurd: "抽象荒诞", cyber: "赛博程序员", gaming: "二次元＋CS", daily: "日常生活", student: "学生", mystic: "轻玄学" };
