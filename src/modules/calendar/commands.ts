import type { Command, CommandInput } from "@qqbot/sdk";
import type { CalendarConfig, CalendarCommand, Source } from "./types.js";
import { readData, snapshot } from "./repository.js";
import type { CommandExecutor } from "../../shared/types.js";
import { calendarService } from "./service.js";
import { renderCalendarQuery } from "./rendering.js";
import { dateAt } from "../../shared/date.js";
import { expand } from "../../shared/interpolation.js";
export async function renderCommand(config: CalendarConfig, sources: Source[], name: CalendarCommand, now: number) {
    if (name === "假期 下个" || name === "假期 剩余") {
        const day = dateAt(now),
            service = calendarService(config, sources, now);
        const kind = name === "假期 下个" ? "next" : "remaining";
        const query =
            kind === "next" ? await service.getNextEvent(day) : await service.getRemainingEvents(+day.slice(0, 4), day);
        return {
            text: renderCalendarQuery(
                query,
                kind,
                config.calendarCopy,
                day,
                service.events,
                true,
            ),
        };
    }

    const day = dateAt(now);
    return { text: expand(config.calendarCopy.help, { today: day, year: day.slice(0, 4) }) };
}
function command(input: CommandInput, name: CalendarCommand, execute: CommandExecutor) {
    return execute(input, name, async () => {
        const data =
            name === "假期" ? { snapshot: await snapshot(input.ctx.db), sources: [] } : await readData(input.ctx.db);
        return renderCommand(data.snapshot.config, data.sources, name, Date.now());
    });
}
export function calendarCommands(execute: CommandExecutor): Record<CalendarCommand, Command> {
    return {
        假期: {
            description: "假期查询帮助",
            scenes: ["group", "c2c"],
            handler: (input) => command(input, "假期", execute),
        },
        "假期 下个": {
            description: "下个尚未开始的节日",
            scenes: ["group", "c2c"],
            handler: (input) => command(input, "假期 下个", execute),
        },
        "假期 剩余": {
            description: "今天起今年所有剩余节日",
            scenes: ["group", "c2c"],
            handler: (input) => command(input, "假期 剩余", execute),
        },
    };
}
