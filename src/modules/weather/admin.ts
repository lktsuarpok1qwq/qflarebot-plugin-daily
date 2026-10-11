import { copyEditor, settings } from "./definition.js";
import type { RouteInput } from "@qqbot/sdk";
import type { WeatherConfig, WeatherState } from "./types.js";
import { body } from "../../shared/request.js";
import { validate } from "./config.js";
import { snapshot, save } from "./repository.js";
import { testConnection } from "./connection.js";
function candidate(value: unknown, state: WeatherState) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("天气配置格式错误");
    }

    const config = structuredClone(value) as WeatherConfig;
    config.apiKey = config.apiKey === null ? "" : config.apiKey === "" ? state.config.apiKey : config.apiKey;
    return validate(config);
}
export async function api({ ctx, request, params }: RouteInput) {
    try {
        const state = await snapshot(ctx.db);

        if (request.method === "GET" && params.action === "state") {
            return Response.json(
                {
                    revision: state.revision,
                    config: { ...state.config, apiKey: "" },
                    hasKey: !!state.config.apiKey,
                    copyEditor, settings,
                },
                { headers: { "cache-control": "no-store" } },
            );
        }

        if (request.method !== "POST" || !["config", "test"].includes(params.action ?? "")) {
            throw new Error("未知接口");
        }

        const data = await body(request),
            config = candidate(data.config, state);

        if (params.action === "config") {
            if (data.revision !== state.revision) {
                throw new Error("天气配置已变化，请刷新后重试");
            }

            return Response.json({ revision: await save(ctx, state, config) });
        }

        if (params.action === "test") {
            return Response.json(await testConnection(config));
        }

        throw new Error("未知接口");
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "天气请求失败" }, { status: 400 });
    }
}
