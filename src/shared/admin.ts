import { AdminError, validateInput } from "./admin-errors.js";
import type { PluginDB, RouteInput } from "@qqbot/sdk";
import type { ConfigState } from "./config-store.js";
import type { Ctx } from "./types.js";
import { body } from "./request.js";

export function adminHandler<Args extends unknown[]>(actions: { GET?: readonly string[]; POST?: readonly string[] }, handler: (input: RouteInput, ...args: Args) => Promise<Response>) {
    return async (input: RouteInput, ...args: Args): Promise<Response> => {
        try {
            const method = input.request.method;

            if (method !== "GET" && method !== "POST") { return Response.json({ error: "不支持的方法" }, { status: 405, headers: { "cache-control": "no-store" } }); }

            if (!actions[method]?.includes(input.params.action ?? "")) { throw new AdminError("validation", "未知接口"); }

            const response = await handler(input, ...args);
            response.headers.set("cache-control", "no-store");

            return response;
        } catch (error) {
            const kind = error instanceof AdminError ? error.kind : "uncertain";

            return Response.json({ error: error instanceof Error ? error.message : "请求失败", kind }, { status: kind === "validation" ? 400 : kind === "conflict" ? 409 : 500, headers: { "cache-control": "no-store" } });
        }
    };
}

export function stateResponse(request: Request, state: object, declaration?: () => object) {
    return Response.json({ ...(new URL(request.url).searchParams.get("data") === "1" ? {} : declaration?.()), ...state });
}

export function configAdmin<T>(options: {
    label: string;
    snapshot: (db: PluginDB) => Promise<ConfigState<T>>;
    save: (ctx: Ctx, state: ConfigState<T>, config: unknown) => Promise<ConfigState<T>>;
    present: (state: ConfigState<T>) => ConfigState<T>;
    declaration?: () => object;
    prepare?: (value: unknown, state: ConfigState<T>) => unknown;
    actions?: Readonly<Record<string, (input: RouteInput) => Promise<Response>>>;
}) {
    if (options.actions && Object.hasOwn(options.actions, "config")) { throw new Error("管理操作重复：config"); }

    return adminHandler({ GET: ["state"], POST: ["config", ...Object.keys(options.actions ?? {})] }, async (input) => {
        const { ctx, request, params } = input;

        if (request.method === "GET") { return stateResponse(request, options.present(await options.snapshot(ctx.db)), options.declaration); }

        if (params.action !== "config") { return options.actions![params.action!]!(input); }

        const data = await body(request), state = await options.snapshot(ctx.db);

        if (data.revision !== state.revision) { throw new AdminError("conflict", options.label + "配置已变化，请刷新后重试"); }

        return Response.json(options.present(await options.save(ctx, state, options.prepare ? validateInput(() => options.prepare!(data.config, state)) : data.config)));
    });
}
