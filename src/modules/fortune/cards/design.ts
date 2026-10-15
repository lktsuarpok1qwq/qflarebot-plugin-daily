import type { CardDefinition } from "../../../shared/cards/types.js";
import type { CardSnapshot } from "./store.js";
import { fortunePresets } from "./presets.js";
const fields = [
    { key: "month", label: "月份", sample: "10" }, { key: "day", label: "日", sample: "15" },
    { key: "title", label: "签名", sample: "鸭总接管" }, { key: "icon", label: "主图标", sample: "🦆" },
    { key: "sign", label: "签文", sample: "今天由鸭总替你主持大局" }, { key: "level", label: "吉凶", sample: "大吉" },
    { key: "score", label: "分数", sample: "98" }, { key: "rarity", label: "稀有度", sample: "普通" }, { key: "date", label: "日期", sample: "10月15日" },
];
const sample = { ...Object.fromEntries(fields.map(f => [f.key, f.sample])), explanation: "你负责点头，鸭总负责把场面安排明白", good: "给自己放行\n大胆开口", bad: "提前投降\n过度脑补", effect: "气场借用\n走路自带董事会背景音", item: "小黄鸭\n今天的临时负责人", effect_name: "气场借用", effect_text: "走路自带董事会背景音", item_name: "小黄鸭", item_text: "今天的临时负责人", egg: "" };
const fortuneSamples = [
    { id: "ordinary", title: "普通主签", values: sample },
    { id: "egg", title: "附带彩蛋", values: { ...sample, egg: "🥚 鸭总批准你提前快乐" } },
    { id: "bad", title: "凶签", values: { ...sample, title: "加载失败", icon: "🎮", level: "小凶", score: "42", sign: "今天的主线任务是别急着点下一步", explanation: "提示还没读完，先把确认键放下", good: "先看说明\n留个存档", bad: "跳过提示\n连点确认", effect: "暂停读条\n给思路一点加载时间", item: "暂停键\n按一下再继续", effect_name: "暂停读条", effect_text: "给思路一点加载时间", item_name: "暂停键", item_text: "按一下再继续" } },
];
export const fortuneDesigns: readonly CardDefinition[] = [
    { id: "small", title: "抽签小卡", width: 540, height: 300, fields, presets: fortunePresets("small"), samples: fortuneSamples.filter(sample => sample.id !== "egg") },
    {
        id: "detail", title: "解签大卡", width: 540, height: 850, presets: fortunePresets("detail"), samples: fortuneSamples, fields: [...fields,
        ...["effect", "item"].flatMap(key => [{ key: key + "_name", label: key === "effect" ? "效果名称" : "幸运物名称", sample: key === "effect" ? "气场借用" : "小黄鸭" }, { key: key + "_text", label: key === "effect" ? "效果说明" : "幸运物说明", sample: "今天的临时负责人" }]),
        { key: "explanation", label: "解签", sample: "你负责点头，鸭总负责把场面安排明白" },
        { key: "good", label: "宜", sample: "宜 给自己放行\n宜 大胆开口" }, { key: "bad", label: "忌", sample: "忌 提前投降\n忌 过度脑补" },
        { key: "effect", label: "今日效果", sample: "气场借用\n走路自带董事会背景音" }, { key: "item", label: "幸运物", sample: "小黄鸭\n今天的临时负责人" },
        { key: "egg", label: "彩蛋", sample: "🥚 鸭总批准你提前快乐" },
        ]
    },
];
export function fortuneDesignValues(snapshot: CardSnapshot): Record<string, string> {
    const { content: c, labels } = snapshot;
    return {
        month: String(Number(c.date.slice(5, 7))), day: String(Number(c.date.slice(8))), effect_name: c.effect.name, effect_text: c.effect.description.text, item_name: c.item.name, item_text: c.item.description.text,
        title: c.title, icon: c.icon, sign: c.sign.text, level: labels.levels[c.level], score: String(c.score), rarity: labels.rarities[c.rarity], date: `${Number(c.date.slice(5, 7))}月${Number(c.date.slice(8))}日`,
        explanation: c.explanation.text, good: c.good.join("\n"), bad: c.bad.join("\n"), effect: c.effect.name + "\n" + c.effect.description.text, item: c.item.name + "\n" + c.item.description.text, egg: c.egg?.text ?? ""
    };
}

export function fortuneHighlights(snapshot: CardSnapshot, color: string) {
    const c = snapshot.content;
    return Object.fromEntries(Object.entries({ sign: c.sign, explanation: c.explanation, effect_text: c.effect.description, item_text: c.item.description, egg: c.egg }).filter(([, phrase]) => phrase?.emphasis?.length).map(([field, phrase]) => [field, { words: phrase!.emphasis!, color }]));
}
