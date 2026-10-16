import { AdminError, validateInput } from "../../shared/admin-errors.js";
import { adminHandler, stateResponse } from "../../shared/admin.js";
import { calendarService } from "./service.js";
import { copyEditor } from "./definition.js";
import type { RouteInput } from "@qqbot/sdk";
import type { CalendarSnapshot, SourceSummary } from "./types.js";
import { readData, saveConfig, snapshot } from "./repository.js";
import { validateCalendar, applyCalendarEdits } from "./validation.js";
import { dateAt } from "../../shared/date.js";
import { body } from "../../shared/request.js";
import { refreshDays } from "./year-data.js";
import { restoreEvent } from "./events.js";
import { CALENDAR_COPY, calendarVariables } from "./copy.js";
import { maintenance } from "./maintenance.js";
type SourceOverview = Omit<SourceSummary, "hash"> & { references: number; has_data: number };
function calendarAdminState(raw: SourceOverview[], now: number) {
    return {
        sources: [0, 1].map((offset) => {
            const year = +dateAt(now).slice(0, 4) + offset;
            const source = raw.find((s) => s.year === year);
            return {
                year,
                updated_at: source?.updated_at ?? 0,
                checked_at: source?.checked_at ?? 0,
                refreshDays: refreshDays(source, offset === 1),
                references: source?.references ?? 0,
                error: source?.error ?? null,
                cached: !!(source?.has_data && source.error),
                hasData: source?.has_schedule === 1,
            };
        }),
    };
}

function present(state: CalendarSnapshot) {
    return { ...state, conflicts: calendarService(state.config).conflicts };
}

export const api = adminHandler({ GET: ["state", "overview"], POST: ["config", "event-reset", "maintenance"] }, async ({ ctx, request, params }: RouteInput): Promise<Response> => {
    const action = params.action ?? "";
    const data = request.method === "POST" ? await body(request) : {};

    if (request.method === "GET" && action === "overview") {
        const [sources, jobs] = await Promise.all([
            ctx.db.all<SourceOverview>("SELECT year,has_schedule,is_complete,error,updated_at,checked_at,CASE WHEN data<>'' THEN COALESCE(json_array_length(data,'$.dates'),0) ELSE 0 END AS \"references\",data<>'' AS has_data FROM {calendar_sources}"),
            ctx.db.all("SELECT * FROM {calendar_jobs}"),
        ]);
        return Response.json({ ...calendarAdminState(sources, Date.now()), jobs });
    }

    if (request.method === "POST" && action === "maintenance") {
        if (data.job !== "sync") {
            throw new AdminError("validation", "维护类型错误");
        }

        return Response.json(await maintenance(ctx, "sync", Date.now(), true));
    }

    const { snapshot: s, sources } =
        action === "event-reset"
            ? await readData(ctx.db)
            : { snapshot: await snapshot(ctx.db), sources: [] };

    if (request.method === "GET" && action === "state") {
        return stateResponse(request, { ...present(s), overview: null }, () => ({ copyEditor, calendarDraft: CALENDAR_COPY.draft, variables: calendarVariables.variables }));
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

        return Response.json(present({
            config,
            revision:
                JSON.stringify(config) === JSON.stringify(s.config)
                    ? s.revision
                    : await saveConfig(ctx, s, config, Date.now()),
        }));
    }

    throw new AdminError("validation", "未知接口");
});
