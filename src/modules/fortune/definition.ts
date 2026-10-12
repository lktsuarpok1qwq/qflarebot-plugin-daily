import { createCopyContract } from "../../shared/copy-contract.js";
import { outputTargets, type CopyDeclaration, type CopyField, type SettingsDeclaration } from "../../shared/declarations.js";
import { FORTUNE_COPY, RESULT_FIELDS, LEVEL_NAMES, RARITY_NAMES, THEME_NAMES, type FortuneCopy } from "./copy.js";
import { LEVELS, RARITIES, THEMES } from "./types.js";
import { fortuneSamples } from "./samples.js";
import { corpus } from "./corpus.js";
export const commands = [{ name: "运势", description: "运势帮助" }, { name: "运势 抽", description: "抽取今日个人运势" }];
const normal = Object.keys(LEVELS);
const branches: Record<keyof FortuneCopy, { label: string; category: string; samples: string[]; variables: Record<string, string> }> = {
    help: { label: "帮助正文", category: "帮助", samples: ["help"], variables: {} },
    body: { label: "抽签正文", category: "整体文案", samples: [...normal, "minimal"], variables: RESULT_FIELDS },
    noIdentity: { label: "身份不可用", category: "查询提示", samples: ["noIdentity"], variables: {} },
    unavailable: { label: "运势不可用", category: "查询提示", samples: ["unavailable"], variables: {} },
    good: { label: "今日宜", category: "宜忌", samples: normal, variables: { items: "宜条目，按条目格式原样连接" } },
    bad: { label: "今日忌", category: "宜忌", samples: normal, variables: { items: "忌条目，按条目格式原样连接" } },
    actionFirst: { label: "首条", category: "宜忌条目", samples: normal, variables: { text: "当前条目内容" } },
    actionNext: { label: "后续条目", category: "宜忌条目", samples: normal, variables: { text: "当前条目内容" } },
    effect: { label: "状态", category: "状态", samples: normal, variables: { kind: "Buff 或 Debuff 的可编辑名称", name: "状态名称", description: "状态说明" } },
    buff: { label: "Buff", category: "状态名称", samples: normal.slice(0, 3), variables: {} },
    debuff: { label: "Debuff", category: "状态名称", samples: normal.slice(3), variables: {} },
    item: { label: "幸运物", category: "幸运物", samples: normal, variables: { name: "物品名称", description: "物品说明" } },
    egg: { label: "彩蛋", category: "彩蛋", samples: normal, variables: { text: "彩蛋内容" } },
    ...Object.fromEntries(Object.entries(LEVEL_NAMES).map(([id, label]) => ["level_" + id, { label, category: "吉凶名称", samples: [id], variables: {} }])) as Record<`level_${keyof typeof LEVELS}`, { label: string; category: string; samples: string[]; variables: Record<string, string> }>,
    ...Object.fromEntries(RARITIES.map((id, i) => ["rarity_" + id, { label: RARITY_NAMES[id], category: "稀有度名称", samples: [normal[i]!], variables: {} }])) as Record<`rarity_${typeof RARITIES[number]}`, { label: string; category: string; samples: string[]; variables: Record<string, string> }>,
};
const declaration: CopyDeclaration = {
    id: "fortune", title: "运势文案", initial: "draw", outputs: outputTargets([{ id: "help", command: "运势" }, { id: "draw", command: "运势 抽" }]),
    description: "样例仅演示排版，不参与抽取；换行与分隔符由模板决定",
    categoryParents: { 宜忌: "整体文案", 宜忌条目: "宜忌", 状态: "整体文案", 状态名称: "状态", 幸运物: "整体文案", 彩蛋: "整体文案", 吉凶名称: "整体文案", 稀有度名称: "整体文案" },
    variableCompositions: {
        good: { description: "今日宜", scope: "今日宜与宜忌条目", fields: { items: "条目格式依次展开，原样连接", text: "当前宜条目" } },
        bad: { description: "今日忌", scope: "今日忌与宜忌条目", fields: { items: "条目格式依次展开，原样连接", text: "当前忌条目" } },
        effect: { description: "状态", scope: "状态文案", fields: branches.effect.variables },
        item: { description: "幸运物", scope: "幸运物文案", fields: branches.item.variables },
        egg: { description: "彩蛋", scope: "彩蛋文案", fields: branches.egg.variables },
    },
    samples: fortuneSamples,
    fields: Object.fromEntries(Object.entries(branches).map(([key, field]) => [key, { ...field, path: ["copy", key], default: FORTUNE_COPY[key as keyof FortuneCopy], allowEmpty: !["help", "body", "noIdentity", "unavailable"].includes(key) }])) satisfies Record<string, CopyField>,
    views: [{ id: "help", keys: ["help"], targets: ["help"] }, { id: "draw", keys: Object.keys(branches).filter((key) => key !== "help"), targets: ["draw"] }],
};
export const copyContract = createCopyContract<{ copy: FortuneCopy }>(declaration);
export const settings: SettingsDeclaration = {
    id: "fortune-settings", title: "运势设置", description: "权重按比例抽取；调整权重、主题或语料可能改变当天结果",
    fields: [
        ...Object.entries(LEVEL_NAMES).map(([id, label]) => ({ key: "level_" + id, id: "fortune-level-" + id, label: label + "权重", type: "number" as const })),
        ...Object.entries(RARITY_NAMES).map(([id, label]) => ({ key: "rarity_" + id, id: "fortune-rarity-" + id, label: label + "权重", type: "number" as const })),
        ...THEMES.filter((id) => corpus.data?.fortunes.some((entry) => entry.theme === id)).map((id) => ({ key: "theme_" + id, id: "fortune-theme-" + id, label: THEME_NAMES[id], type: "checkbox" as const })),
        { key: "eggs", id: "fortune-eggs", label: "参与彩蛋抽取", type: "checkbox" },
    ],
};
