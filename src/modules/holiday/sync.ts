import type { Ctx, Source } from "../../types.js";
import { dateAt, DAY } from "../../scheduler/planner.js";
import { validateConfig } from "../../data/validation.js";
import { readData, saveConfig } from "../../data/repository.js";
import {
  parseResponse,
  refreshHolidays,
  validateYear,
  refreshDays,
  mergeYear,
  type CalendarYear,
} from "./calendar.js";
import {
  hash,
  limitedJson,
  setError,
  checked,
  SOURCE_QUERY,
  type SyncResult,
} from "./source.js";
export async function syncYear(
  ctx: Ctx,
  year: number,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
  force = true,
): Promise<SyncResult> {
  const currentYear = +dateAt(now).slice(0, 4);
  if (year !== currentYear && year !== currentYear + 1)
    throw new Error("只能同步当年和明年");
  try {
    if (!force) {
      const source = await ctx.db.first<Source>(
        `${SOURCE_QUERY} WHERE s.year=?`,
        year,
      );
      let interval = 0;
      try {
        interval = refreshDays(source?.data ?? "", year > currentYear);
      } catch {}
      if (
        interval &&
        source?.checked_at &&
        !source.error &&
        Date.parse(dateAt(now)) - Date.parse(dateAt(source.checked_at)) <
          interval * DAY
      )
        return { year, status: "skipped" };
    }
    const res = await fetcher(
      `https://uapis.cn/api/v1/misc/holiday-calendar?year=${year}&holiday_type=legal`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
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
    const { value, incomplete } = mergeYear(response, old, year > currentYear);
    const error = incomplete ? "年度安排不完整，保留此前已知记录" : null;
    if (!value.holidays.length && !value.dates?.length) {
      await setError(ctx, year, "not_published", now);
      await checked(ctx, year, now, "not_published");
      return { year, status: "not_published" };
    }
    const data = JSON.stringify(value),
      digest = await hash(data);
    if (previous?.hash === digest) {
      await checked(ctx, year, now, error);
      return error
        ? { year, status: "error", error }
        : { year, status: "cached" };
    }
    const published: Source = {
      year,
      hash: digest,
      data,
      error,
      updated_at: now,
    };
    const config = structuredClone(current.snapshot.config);
    refreshHolidays(
      config,
      [...current.sources.filter((s) => s.year !== year), published],
      now,
    );
    validateConfig(config);
    await saveConfig(
      ctx,
      current.snapshot,
      config,
      now,
      false,
      undefined,
      published,
    );
    await checked(ctx, year, now, error);
    return error
      ? { year, status: "error", error }
      : { year, status: "updated" };
  } catch (e) {
    const error = e instanceof Error ? e.message.slice(0, 200) : "sync_failed";
    await setError(ctx, year, error, now);
    return { year, status: "error", error };
  }
}
