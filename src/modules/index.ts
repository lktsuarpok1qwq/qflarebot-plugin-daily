import type { Config, Source } from "../types.js";
import { calendarVariables, calendarValues } from "./calendar/placeholders.js";
// Modules supply already rendered Markdown fragments. Register future modules here.
export const modules = [{ variables: calendarVariables, resolve: calendarValues }];
export const moduleVariables = modules.flatMap((m) => [...m.variables]);
export function createRenderContext(config: Config, sources: Source[], due: number) {
    const cache = new Map<object, Promise<Record<string, string>>>();
    return async (keys: string[]) => {
        const values: Record<string, string> = {};

        for (const module of modules) {
            if (keys.some((k) => (module.variables as readonly string[]).includes(k))) {
                let data = cache.get(module);

                if (!data) {
                    data = module.resolve(config, sources, due);
                    cache.set(module, data);
                }

                const resolved = await data;

                for (const key of keys) {
                    if (Object.hasOwn(resolved, key)) {
                        values[key] = resolved[key]!;
                    }
                }
            }
        }

        return values;
    };
}
