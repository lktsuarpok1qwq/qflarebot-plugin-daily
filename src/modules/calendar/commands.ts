import { commands } from "./definition.js";
import type { ModuleDefinition } from "../../shared/modules.js";
import type { CalendarConfig, CalendarCommand, SourceCoverage } from "./types.js";
import { readQueryData, readHelp } from "./repository.js";
import { calendarService } from "./service.js";
import { renderCalendarQuery } from "./rendering.js";
import { dateAt } from "../../shared/date.js";
import { expand } from "../../shared/interpolation.js";

const reply = (text: string) => text.trim() ? { text } : { text, empty: "skip" as const };

export function renderCommand(config: CalendarConfig, sources: SourceCoverage[], name: CalendarCommand, now: number) {
    if (name === "假期 下个" || name === "假期 剩余") {
        const day = dateAt(now),
            service = calendarService(config, sources, now);
        const kind = name === "假期 下个" ? "next" : "remaining";
        const query =
            kind === "next" ? service.getNextEvent(day) : service.getRemainingEvents(+day.slice(0, 4), day);

        return { ...reply(renderCalendarQuery(query, kind, config.calendarCopy, day, service.events, true, service.confirmedYears)), buttons: config.buttons?.[kind] };
    }

    const day = dateAt(now);

    return { ...reply(expand(config.calendarCopy.help, { today: day, year: day.slice(0, 4) })), buttons: config.buttons?.help };
}

export const calendarCommands: NonNullable<ModuleDefinition["commands"]> = {
    definitions: commands,
    render: async (input, name) => {
        if (name === "假期") {
            const day = dateAt(Date.now());

            const help = await readHelp(input.ctx.db);

            return { ...reply(expand(help.text, { today: day, year: day.slice(0, 4) })), buttons: help.buttons };
        }

        const data = await readQueryData(input.ctx.db);

        return renderCommand(data.snapshot.config, data.sources, name as CalendarCommand, Date.now());
    },
};
