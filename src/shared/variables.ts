import { dateAt } from "./date.js";
import type { Ctx } from "./types.js";
export type VariableComposition = { description: string; scope: string; fields: Readonly<Record<string, string>> };
export type VariableProvider = {
    id: string;
    ui: { title: string };
    variables?: readonly string[];
    variableDescriptions?: Readonly<Record<string, string>>;
    variableCompositions?: Readonly<Record<string, VariableComposition>>;
    variableGroups?: readonly { label: string; variables: readonly string[] }[];
    sampleVariables?: () => Record<string, string>;
    createResolver?: (ctx: Ctx) => (at: number) => Promise<Record<string, string>>;
};
export type VariableAPI = ReturnType<typeof createVariables>;
export function createVariables(modules: readonly VariableProvider[]) {
    const keys = ["日期", "星期", ...modules.flatMap((m) => [...(m.variables ?? [])])];
    const descriptions = { 日期: "发送日期", 星期: "发送日期对应的星期", ...Object.fromEntries(modules.flatMap((m) => Object.entries(m.variableDescriptions ?? {}))) };
    const groups = [{ label: "通用", variables: ["日期", "星期"] }, ...modules.flatMap((m) => (m.variableGroups ?? []).map((group) => ({ ...group, label: m.ui.title + " · " + group.label })))];
    const compositions = Object.fromEntries(modules.flatMap((m) => Object.entries(m.variableCompositions ?? {})));
    /** One read per requested module per round; one rendering per scheduled time. */
    function resolve(ctx: Ctx) {
        const resolvers = new Map<string, ReturnType<NonNullable<VariableProvider["createResolver"]>>>();
        const cache = new Map<string, Map<number, Promise<Record<string, string>>>>();
        return async (keys: string[], at: number) => {
            const values: Record<string, string> = {};

            if (keys.includes("日期") || keys.includes("星期")) {
                const day = dateAt(at);

                if (keys.includes("日期")) { values.日期 = day; }

                if (keys.includes("星期")) { values.星期 = `星期${"日一二三四五六"[new Date(day).getUTCDay()]}`; }
            }

            for (const module of modules) {
                if (!module.createResolver || !keys.some((key) => module.variables?.includes(key))) {
                    continue;
                }

                if (!resolvers.has(module.id)) {
                    resolvers.set(module.id, module.createResolver(ctx));
                    cache.set(module.id, new Map());
                }

                const dates = cache.get(module.id)!;

                if (!dates.has(at)) {
                    dates.set(at, resolvers.get(module.id)!(at));
                }

                const resolved = await dates.get(at)!;

                for (const key of keys) {
                    if (Object.hasOwn(resolved, key)) {
                        values[key] = resolved[key]!;
                    }
                }
            }

            return values;
        };
    }

    const sampleValues = () => ({ 日期: "2026-10-03", 星期: "星期六", ...Object.fromEntries(modules.flatMap((module) => Object.entries(module.sampleVariables?.() ?? {}).filter(([key]) => module.variables?.includes(key)))) });
    return { keys, descriptions, groups, compositions, sampleValues, resolve };
}

export function declareVariables(definitions: Readonly<Record<string, { description: string; group: string; composition?: VariableComposition }>>) {
    const variables = Object.keys(definitions);
    return {
        variables,
        variableCompositions: Object.fromEntries(variables.filter((key) => definitions[key]!.composition).map((key) => [key, definitions[key]!.composition!])),
        variableDescriptions: Object.fromEntries(variables.map((key) => [key, definitions[key]!.description])),
        variableGroups: [...new Set(variables.map((key) => definitions[key]!.group))].map((label) => ({ label, variables: variables.filter((key) => definitions[key]!.group === label) })),
    };
}
