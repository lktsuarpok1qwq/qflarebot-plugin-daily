import type { Ctx } from "../types.js";
import type { ConfigState } from "../config-store.js";
import type { CardDefinition, CardState, CardAssets, CardFormat } from "./types.js";
import { validateDesigns } from "./validation.js";
import { AdminError } from "../admin-errors.js";

type CardResult = { module: ConfigState<{ cardDesigns: CardState }> };
export type CardBinding = {
    definitions: readonly CardDefinition[];
    assets: CardAssets;
    format: CardFormat;
    read: (ctx: Ctx) => Promise<CardResult & { commit: (config: CardState["config"]) => Promise<CardResult> }>;
};

function emptyDesigns(definitions: readonly CardDefinition[]): CardState {
    return { revision: 0, config: validateDesigns(Object.fromEntries(definitions.map(item => [item.id, { ...item.presets[0]!.design, enabled: false }])), definitions, "") };
}

export function bindCards<T extends { cardDesigns?: CardState }>(definitions: readonly CardDefinition[], storage: {
    snapshot: (db: Ctx["db"]) => Promise<ConfigState<T>>;
    save: (ctx: Ctx, old: ConfigState<T>, config: unknown) => Promise<ConfigState<T>>;
    present: (state: ConfigState<T>) => ConfigState<T>;
}, assets: CardAssets = {}, format: CardFormat = "png"): CardBinding {
    return {
        definitions, assets, format,
        async read(ctx) {
            const source = await storage.snapshot(ctx.db), state = source.config.cardDesigns ?? emptyDesigns(definitions);
            const module = storage.present(source);
            const result = { module: { ...module, config: { ...module.config, cardDesigns: state } } };

            return {
                ...result, async commit(config) {
                    if (JSON.stringify(state.config) === JSON.stringify(config)) { return result; }

                    const next = { revision: state.revision + 1, config };
                    const saved = await storage.save(ctx, source, { ...source.config, cardDesigns: next });
                    const module = storage.present(saved);

                    return { module: { ...module, config: { ...module.config, cardDesigns: next } } };
                }
            };
        },
    };
}

export function validateCardRevision(revision: unknown, state: CardState) {
    if (revision !== state.revision) { throw new AdminError("conflict", "卡面已变化，请刷新后重试"); }
}
