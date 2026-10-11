import type { Ctx } from "../../shared/types.js";
import type { Source } from "./types.js";
import { dateAt, DAY } from "../../shared/date.js";
import { validateCalendar } from "./validation.js";
import { readData, saveConfig, SOURCE_QUERY } from "./repository.js";
import { parseResponse, refreshEvents, validateYear, refreshDays, mergeYear, type CalendarYear } from "./calendar.js";
import { hash, limitedJson, recordCheck, type SyncResult } from "./source.js";
export async function syncYear(
    ctx: Ctx,
    year: number,
    fetcher: typeof fetch = fetch,
    now = Date.now(),
    force = true,
): Promise<SyncResult> {
    const currentYear = +dateAt(now).slice(0, 4);

    if (year !== currentYear && year !== currentYear + 1) {
        throw new Error("只能同步当年和明年");
    }

    try {
        if (!force) {
            const source = await ctx.db.first<Source>(`${SOURCE_QUERY} WHERE year=?`, year);
            let interval = 0;

            try {
                interval = refreshDays(source?.data ?? "", year > currentYear);
            } catch { }

            if (
                interval &&
                source?.checked_at &&
                !source.error &&
                Date.parse(dateAt(now)) - Date.parse(dateAt(source.checked_at)) < interval * DAY
            ) {
                return { year, status: "skipped" };
            }
        }

        const res = await fetcher(`https://uapis.cn/api/v1/misc/holiday-calendar?year=${year}&holiday_type=legal`, {
            signal: AbortSignal.timeout(8_000),
        });

        if (!res.ok) {
            await res.body?.cancel().catch(() => { });
            throw new Error(`HTTP_${res.status}`);
        }

        const response = parseResponse(await limitedJson(res), year);
        const current = await readData(ctx.db);
        const previous = current.sources.find((s) => s.year === year);
        let old: CalendarYear | undefined;

        if (previous?.data) {
            try {
                old = validateYear(JSON.parse(previous.data), year);
            } catch {
                // A valid interface response can replace an unreadable cache.
            }
        }

        const { value, incomplete } = mergeYear(response, old);
        const error = incomplete ? "年度安排不完整，保留此前已知记录" : null;

        if (!value.holidays.length && !value.dates?.length) {
            await recordCheck(ctx, year, "not_published", now, true);
            return { year, status: "not_published" };
        }

        const data = JSON.stringify(value),
            digest = await hash(data);

        if (previous?.hash === digest) {
            await recordCheck(ctx, year, error, now, true);
            return error ? { year, status: "error", error } : { year, status: "cached" };
        }

        const published: Source = {
            year,
            hash: digest,
            data,
            error,
            updated_at: now,
            checked_at: now,
        };
        const config = structuredClone(current.snapshot.config);
        refreshEvents(config, [...current.sources.filter((s) => s.year !== year), published], now);
        validateCalendar(config);
        await saveConfig(ctx, current.snapshot, config, now, published);
        return error ? { year, status: "error", error } : { year, status: "updated" };
    } catch (e) {
        const error = e instanceof Error ? e.message.slice(0, 200) : "sync_failed";
        await recordCheck(ctx, year, error, now, false);
        return { year, status: "error", error };
    }
}
