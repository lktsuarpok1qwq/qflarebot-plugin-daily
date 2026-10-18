import type { Route } from "@qqbot/sdk";
import type { CardBinding } from "./store.js";
import { ASSET_PREFIX, fontAsset } from "./types.js";
import { validateCardRevision } from "./store.js";
import { adminHandler } from "../admin.js";
import { AdminError, validateInput } from "../admin-errors.js";
import { body } from "../request.js";
import { validateDesign, validateDesigns } from "./validation.js";
import { prepareFont, uploadBackground } from "./assets.js";
import { storedImageUrl } from "../public-origin.js";
import { renderDesign } from "./render.js";
export function cardAdminRoutes(owner: string, binding: CardBinding): Route[] {
    const definitions = binding.definitions;
    const handler = adminHandler({ GET: ["state"], POST: ["save", "background", "font", "preview"] }, async ({ ctx, request, params }) => {
        if (request.method === "GET") {
            const [state, regular, bold] = await Promise.all([binding.read(ctx), ctx.r2.head(ASSET_PREFIX + fontAsset(400)), ctx.r2.head(ASSET_PREFIX + fontAsset(700))]);
            let realPreview = false;

            try { storedImageUrl(ctx, ASSET_PREFIX, "cards/assets/"); realPreview = true; } catch { /* Local editing remains available without a public address. */ }

            return Response.json({ ...state, definitions, assets: binding.assets, realPreview, fonts: { regular: !!regular, bold: !!bold } });
        }

        if (params.action === "background") {
            const definition = definitions.find(item => item.id === new URL(request.url).searchParams.get("card"));

            if (!definition) { throw new AdminError("validation", "卡面类型无效"); }

            return Response.json({ asset: await uploadBackground(ctx, request, owner, definition.height) });
        }

        const data = await body(request, 40_000);

        if (params.action === "font") { return Response.json({ asset: await prepareFont(ctx, Number(data.weight)) }); }

        if (params.action === "preview") {
            const definition = definitions.find(item => item.id === data.id);

            if (!definition) { throw new AdminError("validation", "卡面类型无效"); }

            const design = validateInput(() => validateDesign(data.design, definition, owner));
            const values = validateInput(() => {
                if (!data.values || typeof data.values !== "object" || Array.isArray(data.values)) { throw new Error("样例无效"); }

                return Object.fromEntries(definition.fields.map(field => {
                    const value = (data.values as Record<string, unknown>)[field.key];

                    if (typeof value !== "string" || value.length > 1000) { throw new Error("样例文字过长或无效"); }

                    return [field.key, value];
                }));
            });
            return new Response(await renderDesign(ctx, design, values, AbortSignal.timeout(10_000), binding.assets, {}, binding.format), { headers: { "content-type": `image/${binding.format}` } });
        }

        const state = await binding.read(ctx);

        validateCardRevision(data.revision, state.module.config.cardDesigns);

        const config = validateInput(() => validateDesigns(data.config, definitions, owner));

        if (JSON.stringify(state.module.config.cardDesigns.config) === JSON.stringify(config)) { return Response.json(state); }

        const weights = new Set<number>();

        for (const definition of definitions) {
            const design = config[definition.id]!;

            if (design.background && !definition.presets.some(preset => preset.design.background === design.background)) {
                const object = await ctx.r2.head(ASSET_PREFIX + design.background);

                if (!object || object.metadata?.height !== String(definition.height)) { throw new AdminError("validation", "背景不存在或尺寸不匹配，请重新上传"); }
            }

            if (design.enabled) {
                for (const region of design.regions) { weights.add(region.weight); }
            }
        }

        for (const weight of weights) {
            if (!await ctx.r2.head(ASSET_PREFIX + fontAsset(weight))) { throw new AdminError("validation", "请先准备字体"); }
        }

        return Response.json(await state.commit(config));
    });
    return (["GET", "POST"] as const).map(method => ({ method, path: `/api/cards/${owner}/:action`, auth: "admin", handler }));
}
