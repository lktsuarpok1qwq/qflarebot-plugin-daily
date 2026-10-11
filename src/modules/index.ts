import type { Ctx } from "../shared/types.js";
import { saying } from "./saying/index.js";
import { weather } from "./weather/index.js";
import { calendar } from "./calendar/index.js";
import type { ModuleAPI } from "./contract.js";
// The composition root is the only place that names concrete modules.
export const modules: readonly ModuleAPI[] = [calendar, weather, saying];
export const moduleVariableGroups = modules.flatMap((m) =>
    (m.variableGroups ?? []).map((group) => ({ ...group, label: m.ui.title + " · " + group.label })),
);
export const moduleVariables = modules.flatMap((m) => [...(m.variables ?? [])]);
export const moduleVariableDescriptions = Object.fromEntries(
    modules.flatMap((m) => Object.entries(m.variableDescriptions ?? {})),
);
/** One read per requested module per round; one rendering per scheduled time. */
export function createRenderContext(ctx: Ctx) {
    const resolvers = new Map<string, ReturnType<NonNullable<ModuleAPI["createResolver"]>>>();
    const cache = new Map<string, Map<number, Promise<Record<string, string>>>>();
    return async (keys: string[], at: number) => {
        const values: Record<string, string> = {};

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
