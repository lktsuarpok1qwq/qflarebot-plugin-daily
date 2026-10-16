import { analyzeTemplate } from "../templates.js";
import type { CardDefinition, CardDesign, CardRegion, CardState } from "./types.js";
const object = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) { throw new Error("卡面配置无效"); }

    return value as Record<string, unknown>;
};
const integer = (value: unknown, min: number, max: number): number => {
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) { throw new Error(`数值须在 ${min}～${max} 之间`); }

    return value;
};
export function validateRegionContent(region: { field: string; text?: string }, fields: readonly { key: string }[]) {
    if (region.text === undefined) {
        if (!fields.some(field => field.key === region.field)) { throw new Error("请选择当前卡面可用的内容"); }

        return;
    }

    if (typeof region.text !== "string" || region.text.length > 1000) { throw new Error("区域文案最多 1000 个字符"); }

    const analysis = analyzeTemplate(region.text, fields.map(field => field.key));

    if (analysis.error) { throw Object.assign(new Error(analysis.error.message), analysis.error); }

    if (/[{}]/.test(region.text.replace(/\{\{[^{}]+\}\}/g, ""))) { throw new Error("变量请写为 {{变量名}}"); }
}
export function validateDesign(value: unknown, definition: CardDefinition, owner: string): CardDesign {
    const source = object(value);

    if (typeof source.enabled !== "boolean" || typeof source.background !== "string" || (source.background && !definition.presets.some(preset => preset.design.background === source.background) && !new RegExp(`^${owner}-[0-9]{13}-[0-9a-f-]{36}\\.png$`).test(source.background))) { throw new Error("背景或启用状态无效"); }

    if (!Array.isArray(source.regions) || source.regions.length > 24) { throw new Error("最多设置 24 个区域"); }

    const ids = new Set<string>();
    const regions = source.regions.map((raw): CardRegion => {
        const r = object(raw);

        if (typeof r.id !== "string" || !/^[a-z0-9-]{1,50}$/.test(r.id) || ids.has(r.id)) { throw new Error("区域标识无效或重复"); }

        ids.add(r.id);

        if (typeof r.field !== "string") { throw new Error("区域内容无效"); }

        validateRegionContent(r as { field: string; text?: string }, definition.fields);

        if (r.weight !== 400 && r.weight !== 700) { throw new Error("字重无效"); }

        if (typeof r.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(r.color)) { throw new Error("颜色须为六位十六进制"); }

        if (!["left", "center", "right"].includes(String(r.align))) { throw new Error("对齐方式无效"); }

        const x = integer(r.x, 0, definition.width - 1), y = integer(r.y, 0, definition.height - 1);
        const size = integer(r.size, 12, 72);
        return { id: r.id, field: r.field, ...(r.text === undefined ? {} : { text: r.text as string }), x, y, width: integer(r.width, 12, definition.width - x), height: integer(r.height, size, definition.height - y), size, weight: r.weight, color: r.color, align: r.align as CardRegion["align"], lineHeight: integer(r.lineHeight, size, 100) };
    });

    if (source.enabled && (!source.background || !regions.length)) { throw new Error("启用前请上传背景并设置区域"); }

    return { enabled: source.enabled, background: source.background, regions };
}
export function validateDesigns(value: unknown, definitions: readonly CardDefinition[], owner: string) {
    const input = object(value);

    if (Object.keys(input).some(id => !definitions.some(definition => definition.id === id))) { throw new Error("卡面类型无效"); }

    return Object.fromEntries(definitions.map(definition => [definition.id, validateDesign(input[definition.id], definition, owner)]));
}

export function validateCardState(value: unknown, definitions: readonly CardDefinition[], owner: string): CardState {
    const state = object(value);
    return { revision: integer(state.revision, 0, Number.MAX_SAFE_INTEGER), config: validateDesigns(state.config, definitions, owner) };
}
