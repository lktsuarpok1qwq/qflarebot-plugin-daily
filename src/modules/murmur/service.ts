import { dateAt } from "../../shared/date.js";
import { expand } from "../../shared/interpolation.js";
import type { Ctx } from "../../shared/types.js";
import type { MurmurConfig } from "./config.js";
import { current, selectDay } from "./repository.js";

export function render(config: Pick<MurmurConfig, "copy">, text: string) {
    return expand(config.copy.today, {}, { text });
}

export function createResolver(ctx: Ctx) {
    return async (at: number) => {
        const day = dateAt(at);
        let state = await current(ctx.db, day);

        if (!state.template.trim()) { return { "絮语.今日": "" }; }

        let text = state.text;

        if (text === null && day === dateAt(Date.now())) {
            const selected = await selectDay(ctx.db, day, state.revision);

            if (selected) { text = selected.text; } else {
                state = await current(ctx.db, day);
                text = state.text;
            }
        }

        return { "絮语.今日": text !== null ? render({ copy: { today: state.template } }, text) : "" };
    };
}
