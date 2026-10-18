import { validateInput } from "../../shared/admin-errors.js";
import { copyEditor, settings } from "./definition.js";
import { configAdmin } from "../../shared/admin.js";
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
    return config;
}
export const present = (state: WeatherState) => ({ revision: state.revision, config: { ...state.config, apiKey: "" }, hasKey: !!state.config.apiKey });
export const api = configAdmin({
    label: "天气", snapshot, save,
    present,
    declaration: () => ({ copyEditor, settings }),
    prepare: candidate,
    actions: {
        test: async ({ ctx, request }) => {
            const data = await body(request), state = await snapshot(ctx.db);
            return Response.json(await testConnection(validateInput(() => validate(candidate(data.config, state)))));
        },
    },
});
