import type { RouteInput } from "@qqbot/sdk";
import type { Source } from "./types.js";
import { readData, saveConfig, snapshot } from "./repository.js";
import { validateCalendar, applyCalendarEdits } from "./validation.js";
import { dateAt } from "../../shared/date.js";
import { body } from "../../shared/request.js";
import { hasCalendar, refreshDays, restoreEvent, type CalendarYear } from "./calendar.js";
import { CALENDAR_COPY } from "./copy.js";
import { calendarCopyVariables } from "./copy-fields.js";
import { calendarValues, calendarVariables } from "./placeholders.js";
import { importEvents } from "./importer.js";
import { renderCommand } from "./commands.js";
import { maintenance } from "./maintenance.js";
export function calendarAdminState(raw: Source[], now: number) {
    return {
        calendarDefaults: CALENDAR_COPY.text,
        calendarDraft: CALENDAR_COPY.draft,
        calendarCopyVariables,
        sources: [0, 1].map((offset) => {
            const year = +dateAt(now).slice(0, 4) + offset;
            const source = raw.find((s) => s.year === year);
            return {
                year,
                updated_at: source?.updated_at ?? 0,
                checked_at: source?.checked_at ?? 0,
                refreshDays: refreshDays(source?.data ?? "", offset === 1),
                references: source?.data ? ((JSON.parse(source.data) as CalendarYear).dates?.length ?? 0) : 0,
                error: source?.error ?? null,
                hasData: source ? hasCalendar(source.data) : false,
            };
        }),
    };
}

export async function api({ ctx, request, params }: RouteInput): Promise<Response> {
    try {
        const action = params.action ?? "";
        const data = request.method === "POST" ? await body(request) : {};

        if (request.method === "POST" && action === "maintenance") {
            if (data.job !== "sync") {
                throw new Error("维护类型错误");
            }

            return Response.json(await maintenance(ctx, "sync", Date.now(), true));
        }

        const { snapshot: s, sources } =
            action === "config" || action === "import-preview" || (action === "copy-preview" && data.subject === "help")
                ? { snapshot: await snapshot(ctx.db), sources: [] }
                : await readData(ctx.db);

        if (request.method === "GET" && action === "state") {
            return Response.json({
                ...s,
                ...calendarAdminState(sources, Date.now()),
                variables: calendarVariables,
                jobs: await ctx.db.all("SELECT * FROM {calendar_jobs}"),
            });
        }

        if (request.method !== "POST") {
            throw new Error("未知接口");
        }

        if (action === "config" || action === "event-reset") {
            if (data.revision !== s.revision) {
                throw new Error("日历配置已变化，请刷新");
            }

            const config = action === "config" ? validateCalendar(data.config) : structuredClone(s.config);

            if (action === "config") {
                applyCalendarEdits(config, s.config);
            } else {
                if (typeof data.id !== "string") {
                    throw new Error("请选择日历事件");
                }

                restoreEvent(config, sources, data.id, Date.now());
            }

            return Response.json({
                revision:
                    JSON.stringify(config) === JSON.stringify(s.config)
                        ? s.revision
                        : await saveConfig(ctx, s, config, Date.now()),
            });
        }

        if (action === "copy-preview") {
            const config = validateCalendar(data.config),
                now = Date.now();

            if (data.subject === "help") {
                return Response.json({
                    commandName: "/假期",
                    command: (await renderCommand(config, sources, "假期", now)).text,
                });
            }

            const variable =
                data.subject === "next"
                    ? "日历.下一个"
                    : data.subject === "remaining"
                        ? "日历.今年剩余"
                        : data.subject === "today"
                            ? "日历.今日"
                            : data.subject === "eventToday"
                                ? "日历.今日节日"
                                : undefined;

            if (!variable) {
                throw new Error("请选择预览内容");
            }

            const values = await calendarValues(config, sources, now);
            const command =
                data.subject === "next" || data.subject === "remaining"
                    ? (await renderCommand(config, sources, data.subject === "next" ? "假期 下个" : "假期 剩余", now))
                        .text
                    : undefined;
            return Response.json({
                variable,
                text: values[variable],
                command,
                commandName: command === undefined ? undefined : data.subject === "next" ? "/假期 下个" : "/假期 剩余",
            });
        }

        if (action === "import-preview") {
            if (typeof data.text !== "string") {
                throw new Error("导入参数错误");
            }

            return Response.json({ ...importEvents(data.text, s.config.events), revision: s.revision });
        }

        throw new Error("未知接口");
    } catch (e) {
        return Response.json({ error: e instanceof Error ? e.message : "日历请求失败" }, { status: 400 });
    }
}
