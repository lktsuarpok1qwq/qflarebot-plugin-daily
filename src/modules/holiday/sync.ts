import type { Ctx, Source } from "../../types.js";
import { dateAt } from "../../scheduler/planner.js";
import { validateConfig } from "../../data/validation.js";
import { readData, saveConfig } from "../../data/repository.js";
import { parseResponse, refreshHolidays } from "./calendar.js";
import { hash, limitedJson, setError, type SyncResult } from "./source.js";
export async function syncYear(
  ctx: Ctx,
  year: number,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<SyncResult> {
  const currentYear = +dateAt(now).slice(0, 4);
  if (year !== currentYear && year !== currentYear + 1)
    throw new Error("只能同步当年和明年");
  try {
    const res = await fetcher(
      `https://uapis.cn/api/v1/misc/holiday-calendar?year=${year}&holiday_type=legal`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const value = parseResponse(await limitedJson(res), year);
    if (!value.holidays.length) {
      await setError(ctx, year, "not_published", now);
      return { year, status: "not_published" };
    }
    const data = JSON.stringify(value),
      digest = await hash(data);
    const current = await readData(ctx.db);
    const previous = current.sources.find((s) => s.year === year);
    if (previous?.hash === digest) {
      if (previous.error)
        await ctx.db.run(
          "UPDATE {sources} SET error=NULL,updated_at=? WHERE year=?",
          now,
          year,
        );
      return { year, status: "cached" };
    }
    const published: Source = {
      year,
      hash: digest,
      data,
      error: null,
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
    return { year, status: "updated" };
  } catch (e) {
    const error = e instanceof Error ? e.message.slice(0, 200) : "sync_failed";
    await setError(ctx, year, error, now);
    return { year, status: "error", error };
  }
}
