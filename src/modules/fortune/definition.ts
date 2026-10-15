import { createCopyContract } from "../../shared/copy-contract.js";
import { outputTargets, type CopyDeclaration, type CopyField, type SettingsDeclaration } from "../../shared/declarations.js";
import { FORTUNE_COPY, FORTUNE_TEXT_VARIABLES, FORTUNE_DETAIL_VARIABLES, LEVEL_NAMES, RARITY_NAMES, THEME_NAMES, type FortuneCopy } from "./copy.js";
import { LEVELS, RARITIES, THEMES } from "./types.js";
import { fortuneSamples } from "./samples.js";
import { corpus } from "./corpus.js";
export const commands = [{ name: "运势", description: "运势帮助" }, { name: "运势 抽", description: "抽取今日个人运势" }, { name: "运势 解", description: "查看今日解签" }];
const branches: Record<keyof FortuneCopy, { label: string; category: string; samples: string[]; variables: Record<string, string> }> = {
    drawText: { label: "抽签正文", category: "文字回复", samples: ["drawText"], variables: FORTUNE_TEXT_VARIABLES },
    detailText: { label: "解签正文", category: "文字回复", samples: ["detailText", "detailTextEgg"], variables: FORTUNE_DETAIL_VARIABLES },
    drawCaption: { label: "小卡下方", category: "图片附言", samples: ["drawCaption"], variables: {} },
    detailCaption: { label: "大卡下方", category: "图片附言", samples: ["detailCaption"], variables: {} },
    needDraw: { label: "先抽签", category: "查询提示", samples: ["needDraw"], variables: {} },
    help: { label: "帮助正文", category: "帮助", samples: ["help"], variables: {} },
    noIdentity: { label: "身份不可用", category: "查询提示", samples: ["noIdentity"], variables: {} },
    unavailable: { label: "运势不可用", category: "查询提示", samples: ["unavailable"], variables: {} },
    ...Object.fromEntries(Object.entries(LEVEL_NAMES).map(([id, label]) => ["level_" + id, { label, category: "吉凶名称", samples: ["level_" + id], variables: {} }])) as Record<`level_${keyof typeof LEVELS}`, { label: string; category: string; samples: string[]; variables: Record<string, string> }>,
    ...Object.fromEntries(RARITIES.map((id) => ["rarity_" + id, { label: RARITY_NAMES[id], category: "稀有度名称", samples: ["rarity_" + id], variables: {} }])) as Record<`rarity_${typeof RARITIES[number]}`, { label: string; category: string; samples: string[]; variables: Record<string, string> }>,
};
const declaration: CopyDeclaration = {
    id: "fortune", title: "运势文案", initial: "draw", outputs: outputTargets([{ id: "help", command: "运势" }, { id: "draw", command: "运势 抽" }, { id: "detail", command: "运势 解" }]),
    description: "关闭图片或图片准备失败时使用文字回复；吉凶和稀有度名称次日抽签生效；情景预览展示当前文字",
    samples: fortuneSamples,
    fields: Object.fromEntries(Object.entries(branches).map(([key, field]) => [key, { ...field, path: ["copy", key], default: FORTUNE_COPY[key as keyof FortuneCopy], allowEmpty: ["drawCaption", "detailCaption"].includes(key) }])) satisfies Record<string, CopyField>,
    views: [
        { id: "help", keys: ["help"], targets: ["help"] },
        { id: "draw", keys: Object.keys(branches).filter(key => !["help", "needDraw", "detailCaption", "detailText"].includes(key)), targets: ["draw"] },
        { id: "detail", keys: Object.keys(branches).filter(key => !["help", "drawCaption", "drawText"].includes(key)), targets: ["detail"] }
    ],
};
export const copyContract = createCopyContract<{ copy: FortuneCopy }>(declaration);
export const settings: SettingsDeclaration = {
    id: "fortune-settings", title: "运势设置", description: "图片开关保存后生效，准备超过 10 秒改发文字；抽取设置次日生效",
    fields: [
        { key: "imageEnabled", id: "fortune-image-enabled", label: "启用图片卡片", group: "功能开关", type: "checkbox" },
        { key: "eggs", id: "fortune-eggs", label: "参与彩蛋抽取", group: "功能开关", type: "checkbox" },
        ...THEMES.filter((id) => Object.values(corpus.cards[id]).some(range => range[1] > 0)).map((id) => ({ key: "theme_" + id, id: "fortune-theme-" + id, label: THEME_NAMES[id], group: "语料类型", type: "checkbox" as const })),
        ...Object.entries(LEVEL_NAMES).map(([id, label]) => ({ key: "level_" + id, id: "fortune-level-" + id, label: label + "权重", group: "吉凶权重", type: "number" as const })),
        ...Object.entries(RARITY_NAMES).map(([id, label]) => ({ key: "rarity_" + id, id: "fortune-rarity-" + id, label: label + "权重", group: "稀有度权重", type: "number" as const })),

    ],
};
