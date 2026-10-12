import { readJson } from "../../shared/json.js";
import type { Ctx } from "../../shared/types.js";
import type { Source, SourceSummary } from "./types.js";
import { dateAt, DAY } from "../../shared/date.js";
import { readData, saveConfig, SOURCE_QUERY, SOURCE_SUMMARY_QUERY } from "./repository.js";
import { parseResponse, validateYear, refreshDays, mergeYear, summarizeYear, type CalendarYear } from "./year-data.js";
import { refreshEvents } from "./events.js";
import { hash, recordCheck, type SyncResult } from "./source.js";
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
            const source = await ctx.db.first<SourceSummary>(`${SOURCE_SUMMARY_QUERY} WHERE year=?`, year);
            const interval = refreshDays(source ?? undefined, year > currentYear);

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
            redirect: "manual",
        });

        if (!res.ok) {
            await res.body?.cancel().catch(() => { });
            throw new Error(`HTTP_${res.status}`);
        }

        const response = parseResponse(await readJson(res, 256_000, "假期源"), year);
        const previous = await ctx.db.first<Source>(`${SOURCE_QUERY} WHERE year=?`, year);

        if (previous && Math.max(previous.checked_at, previous.updated_at) > now) {
            return { year, status: "skipped" };
        }

        let prepared = await prepare(response, previous);

        if (!prepared.value.holidays.length && !prepared.value.dates?.length) {
            await recordCheck(ctx, year, "not_published", now, true);
            return { year, status: "not_published" };
        }

        if (previous?.hash === prepared.digest) {
            await recordCheck(ctx, year, prepared.error, now, true);
            return prepared.error ? { year, status: "error", error: prepared.error } : { year, status: "cached" };
        }

        // Read editable state only when publishing changed data, then merge against the latest source.
        const current = await readData(ctx.db), latest = current.sources.find((s) => s.year === year);

        if (latest && Math.max(latest.checked_at, latest.updated_at) > now) {
            return { year, status: "skipped" };
        }

        if (latest?.hash !== previous?.hash) {
            prepared = await prepare(response, latest);

            if (latest?.hash === prepared.digest) {
                await recordCheck(ctx, year, prepared.error, now, true);
                return prepared.error ? { year, status: "error", error: prepared.error } : { year, status: "cached" };
            }
        }

        const { data, digest, error } = prepared;
        const published: Source = {
            year,
            hash: digest,
            ...summarizeYear(prepared.value),
            data,
            error,
            updated_at: now,
            checked_at: now,
        };
        const config = structuredClone(current.snapshot.config);
        refreshEvents(config, [...current.sources.filter((s) => s.year !== year), published], now);
        await saveConfig(ctx, current.snapshot, config, now, published);
        return error ? { year, status: "error", error } : { year, status: "updated" };
    } catch (e) {
        const error = e instanceof Error ? e.message.slice(0, 200) : "sync_failed";
        await recordCheck(ctx, year, error, now, false);
        return { year, status: "error", error };
    }
}

async function prepare(response: CalendarYear, previous: Source | null | undefined) {
    let old: CalendarYear | undefined;

    if (previous?.data) {
        try {
            old = validateYear(JSON.parse(previous.data), response.year);
        } catch {
            // A valid interface response can replace an unreadable cache.
        }
    }

    const { value, incomplete } = mergeYear(response, old);
    const data = JSON.stringify(value);
    return { value, data, digest: await hash(data), error: incomplete ? "年度安排不完整，保留此前已知记录" : null };
}
