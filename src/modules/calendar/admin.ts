import { AdminError, validateInput } from "../../shared/admin-errors.js";
import { adminHandler, stateResponse } from "../../shared/admin.js";
import { calendarService } from "./service.js";
import { copyEditor } from "./definition.js";
import type { RouteInput } from "@qqbot/sdk";
import type { Source } from "./types.js";
import { readData, saveConfig, snapshot } from "./repository.js";
import { validateCalendar, applyCalendarEdits } from "./validation.js";
import { dateAt } from "../../shared/date.js";
import { body } from "../../shared/request.js";
import { refreshDays, type CalendarYear } from "./year-data.js";
import { restoreEvent } from "./events.js";
import { CALENDAR_COPY, calendarVariables } from "./copy.js";
import { maintenance } from "./maintenance.js";
export function calendarAdminState(raw: Source[], now: number) {
    return {
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

export const api = adminHandler({ GET: ["state"], POST: ["config", "event-reset", "maintenance"] }, async ({ ctx, request, params }: RouteInput): Promise<Response> => {
    const action = params.action ?? "";
    const data = request.method === "POST" ? await body(request) : {};

    if (request.method === "POST" && action === "maintenance") {
        if (data.job !== "sync") {
            throw new AdminError("validation", "维护类型错误");
        }

        return Response.json(await maintenance(ctx, "sync", Date.now(), true));
    }

    const { snapshot: s, sources } =
        action === "config"
            ? { snapshot: await snapshot(ctx.db), sources: [] }
            : await readData(ctx.db);

    if (request.method === "GET" && action === "state") {
        return stateResponse(request, {
            ...s,
            conflicts: calendarService(s.config, sources).conflicts,
            ...calendarAdminState(sources, Date.now()),
            jobs: await ctx.db.all("SELECT * FROM {calendar_jobs}"),
        }, () => ({ copyEditor, calendarDraft: CALENDAR_COPY.draft, variables: calendarVariables.variables }));
    }

    if (action === "config" || action === "event-reset") {
        if (data.revision !== s.revision) {
            throw new AdminError("conflict", "日历配置已变化，请刷新");
        }

        const config = validateInput(() => {
            const config = action === "config" ? validateCalendar(data.config) : structuredClone(s.config);

            if (action === "config") {
                applyCalendarEdits(config, s.config);
            } else {
                if (typeof data.id !== "string") {
                    throw new Error("请选择日历事件");
                }

                restoreEvent(config, sources, data.id, Date.now());
            }

            return config;
        });

        return Response.json({
            revision:
                JSON.stringify(config) === JSON.stringify(s.config)
                    ? s.revision
                    : await saveConfig(ctx, s, config, Date.now()),
            refresh: true,
        });
    }

    throw new AdminError("validation", "未知接口");
});
