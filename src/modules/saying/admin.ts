import { copyEditor } from "./definition.js";
import type { RouteInput } from "@qqbot/sdk";
import { body } from "../../shared/request.js";
import { validate } from "./config.js";
import { snapshot, save } from "./repository.js";
export async function api({ ctx, request, params }: RouteInput) {
    try {
        const state = await snapshot(ctx.db);

        if (request.method === "GET" && params.action === "state") {
            return Response.json({ ...state, copyEditor }, { headers: { "cache-control": "no-store" } });
        }

        if (request.method !== "POST" || params.action !== "config") {
            throw new Error("未知接口");
        }

        const data = await body(request), config = validate(data.config);

        if (params.action === "config") {
            if (data.revision !== state.revision) {
                throw new Error("一言配置已变化，请刷新后重试");
            }

            return Response.json({ revision: await save(ctx, state, config) });
        }

        throw new Error("未知接口");
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "一言请求失败" }, { status: 400 });
    }
}
