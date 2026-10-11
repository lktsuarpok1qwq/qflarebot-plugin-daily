import type { RouteInput } from "@qqbot/sdk";
import { snapshot, saveConfig } from "./data/repository.js";
import { validateConfig } from "./data/validation.js";
import { copyEditor, outputs } from "./content/definition.js";
import { BODY_BYTES } from "./shared/types.js";
import { body } from "./shared/request.js";
import { commandLinks } from "./commands.js";
export async function api({ ctx, request, params }: RouteInput): Promise<Response> {
    try {
        const action = params.action;

        if (request.method === "GET") {
            if (action === "state") {
                return Response.json({
                    ...await snapshot(ctx.db),
                    copyEditor: { ...copyEditor, samples: outputs.map((target) => ({ id: target.id, name: target.command ? "无特殊情景" : target.name, values: { today: "2026-10-03", year: "2026" }, fragments: { commands: commandLinks } })) },
                });
            }

            throw new Error("未知接口");
        }

        if (request.method !== "POST") { return Response.json({ error: "不支持的方法" }, { status: 405 }); }

        const data = await body(request, BODY_BYTES + 4096), s = await snapshot(ctx.db);

        if (action === "config") {
            if (data.revision !== s.revision) { throw new Error("配置已变化，请刷新"); }

            const config = validateConfig(data.config);
            return Response.json({ revision: JSON.stringify(config) === JSON.stringify(s.config) ? s.revision : await saveConfig(ctx, s, config) });
        }

        throw new Error("未知接口");
    } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "请求失败" }, { status: 400 }); }
}
