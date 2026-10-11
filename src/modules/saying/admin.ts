import type { RouteInput } from "@qqbot/sdk";
import { body } from "../../shared/request.js";
import { validate } from "./config.js";
import { snapshot, save } from "./repository.js";
import { SAYING_COPY, SAYING_FIELDS } from "./copy.js";
import { randomSaying } from "./provider.js";
import { render, today } from "./service.js";
export async function api({ ctx, request, params }: RouteInput) {
    try {
        const state = await snapshot(ctx.db);

        if (request.method === "GET" && params.action === "state") {
            return Response.json({ ...state, defaults: SAYING_COPY, fields: SAYING_FIELDS }, { headers: { "cache-control": "no-store" } });
        }

        if (request.method !== "POST" || !["config", "preview"].includes(params.action ?? "")) {
            throw new Error("未知接口");
        }

        const data = await body(request), config = validate(data.config);

        if (params.action === "config") {
            if (data.revision !== state.revision) {
                throw new Error("一言配置已变化，请刷新后重试");
            }

            return Response.json({ revision: await save(ctx, state, config) });
        }

        if (data.target !== "command" && data.target !== "today") {
            throw new Error("请选择预览内容");
        }

        const text = data.target === "command" ? await randomSaying() : await today(ctx, Date.now());
        return Response.json({ text: render(config, text) });
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "一言请求失败" }, { status: 400 });
    }
}
