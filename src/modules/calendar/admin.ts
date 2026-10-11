import { calendarService } from "./service.js";
import { copyEditor } from "./definition.js";
import type { RouteInput } from "@qqbot/sdk";
import type { Source } from "./types.js";
import { readData, saveConfig, snapshot } from "./repository.js";
import { validateCalendar, applyCalendarEdits } from "./validation.js";
import { dateAt } from "../../shared/date.js";
import { body } from "../../shared/request.js";
import { refreshDays, restoreEvent, type CalendarYear } from "./calendar.js";
import { CALENDAR_COPY, calendarVariables } from "./copy.js";
import { maintenance } from "./maintenance.js";
export function calendarAdminState(raw: Source[], now: number) {
    return {
        calendarDraft: CALENDAR_COPY.draft,
        sources: [0, 1].map((offset) => {
            const year = +dateAt(now).slice(0, 4) + offset;
            const source = raw.find((s) => s.year === year);
            return {
                year,
                updated_at: source?.updated_at ?? 0,
                checked_at: source?.checked_at ?? 0,
                refreshDays: refreshDays(source, offset === 1),
                references: source?.data ? ((JSON.parse(source.data) as CalendarYear).dates?.length ?? 0) : 0,
                error: source?.error ?? null,
                cached: !!(source?.data && source.error),
                hasData: source?.has_schedule === 1,
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
            action === "config"
                ? { snapshot: await snapshot(ctx.db), sources: [] }
                : await readData(ctx.db);

        if (request.method === "GET" && action === "state") {
            return Response.json({
                ...s,
                copyEditor,
                conflicts: calendarService(s.config, sources).conflicts,
                ...calendarAdminState(sources, Date.now()),
                variables: calendarVariables.variables,
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

        throw new Error("未知接口");
    } catch (e) {
        return Response.json({ error: e instanceof Error ? e.message : "日历请求失败" }, { status: 400 });
    }
}
