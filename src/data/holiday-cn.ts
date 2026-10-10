import type { Ctx, Source } from "../types.js";
import { dateAt, validDate } from "../scheduler/planner.js";
import { validateConfig } from "./validation.js";
import {
  saveConfig,
  snapshot,
  readData,
  refreshCalendar,
} from "./repository.js";
import { refreshHolidays, hasCalendar } from "./calendar.js";
import { syncFestivals } from "./festivals.js";
import { hash, limitedJson, setError, type SyncResult } from "./source.js";
export type RawYear = {
  year: number;
  papers: string[];
  days: { name: string; date: string; isOffDay: boolean }[];
};
export function validateYear(value: unknown, year: number): RawYear {
  const x = value as RawYear;
  if (
    !x ||
    x.year !== year ||
    !Array.isArray(x.papers) ||
    x.papers.length > 30 ||
    x.papers.some(
      (p) =>
        typeof p !== "string" || !/^https?:\/\/(?:[\w-]+\.)*gov\.cn\//.test(p),
    ) ||
    !Array.isArray(x.days) ||
    x.days.length > 400
  )
    throw new Error("假期源 schema 非法");
  const days = new Set<string>();
  for (const d of x.days) {
    if (
      !d ||
      typeof d.name !== "string" ||
      !d.name.trim() ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(d.name) ||
      [...d.name].length > 80 ||
      !validDate(d.date) ||
      Math.abs(+d.date.slice(0, 4) - year) > 1 ||
      typeof d.isOffDay !== "boolean" ||
      days.has(d.date)
    )
      throw new Error("假期源日期冲突或非法");
    days.add(d.date);
  }
  // Ignore representation-only changes (key order, day order, duplicate papers).
  return {
    year,
    papers: [...new Set(x.papers)].sort(),
    days: x.days
      .map((d) => ({ name: d.name, date: d.date, isOffDay: d.isOffDay }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
export async function syncYear(
  ctx: Ctx,
  year: number,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<SyncResult> {
  if (!Number.isInteger(year) || year < 2000 || year > 2199)
    throw new Error("同步年度非法");
  const previous = await ctx.db.first<Source>(
    "SELECT * FROM {sources} WHERE year=? AND kind='official'",
    year,
  );
  try {
    const res = await fetcher(
      `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (res.status === 404) {
      await setError(ctx, year, "not_published", now);
      return { kind: "official", year, status: "not_published" };
    }
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const value = validateYear(await limitedJson(res), year),
      data = JSON.stringify(value),
      digest = await hash(data);
    if (!hasCalendar(data)) {
      await setError(ctx, year, "not_published", now);
      return { kind: "official", year, status: "not_published" };
    }
    if (previous?.hash === digest) {
      if (previous.error)
        await ctx.db.run(
          "UPDATE {sources} SET error=NULL,updated_at=? WHERE year=? AND kind='official'",
          now,
          year,
        );
      return { kind: "official", year, status: "cached" };
    }
    // Publish automatic dates, cursors, and source in the same D1 transaction.
    const current = await readData(ctx.db),
      s = current.snapshot,
      config = structuredClone(s.config);
    const published: Source = {
      kind: "official",
      year,
      hash: digest,
      data,
      error: null,
      updated_at: now,
    };
    refreshHolidays(
      config,
      [
        ...current.sources.filter(
          (s) => s.year !== year || s.kind === "festival",
        ),
        published,
      ],
      now,
    );
    validateConfig(config);
    await saveConfig(ctx, s, config, now, false, undefined, published);
    return { kind: "official", year, status: "updated" };
  } catch (e) {
    const error = e instanceof Error ? e.message.slice(0, 200) : "sync_failed";
    await setError(ctx, year, error, now);
    return { kind: "official", year, status: "error", error };
  }
}

export async function maintenance(
  ctx: Ctx,
  job: "sync" | "cleanup",
  scheduledAt: number,
  manual = false,
  yearOffset?: 0 | 1,
  sourceKind?: "official" | "festival",
) {
  const day = dateAt(scheduledAt);
  const results: SyncResult[] = [];
  const jobKey =
    job === "sync" && yearOffset !== undefined
      ? `sync:${sourceKind ?? "all"}:${yearOffset}`
      : job;
  if (!manual) {
    const r = await ctx.db.run(
      "INSERT INTO {maintenance}(job,day,error) VALUES (?,?,NULL) ON CONFLICT(job) DO UPDATE SET day=excluded.day WHERE day<>excluded.day",
      jobKey,
      day,
    );
    if (!r.changes) return { ok: true, message: "今天已执行维护", results };
  }
  try {
    // Changed sources rebuild the calendar when published. Only daily cleanup
    // and a manual refresh need to rebuild an unchanged cache.
    if (job === "cleanup") await refreshCalendar(ctx, scheduledAt);
    if (job === "sync") {
      const year = +day.slice(0, 4);
      for (const y of yearOffset === undefined
        ? [year, year + 1]
        : [year + yearOffset])
        if (y >= 2000 && y <= 2199) {
          for (const kind of sourceKind
            ? [sourceKind]
            : (["official", "festival"] as const)) {
            try {
              results.push(
                await (kind === "official"
                  ? syncYear(ctx, y, fetch, scheduledAt)
                  : syncFestivals(ctx, y, fetch, scheduledAt, manual)),
              );
            } catch (error) {
              results.push({
                kind,
                year: y,
                status: "error",
                error: String(error).slice(0, 200),
              });
            }
          }
        }
      // Refresh after fetching so a damaged cache cannot prevent its replacement.
      if (manual) await refreshCalendar(ctx, scheduledAt);
    } else {
      const s = await snapshot(ctx.db);
      await ctx.db.run(
        "DELETE FROM {deliveries} WHERE key IN (SELECT key FROM {deliveries} WHERE updated_at<? AND status<>'sending' ORDER BY updated_at LIMIT 200)",
        scheduledAt - s.config.retentionDays * 86_400_000,
      );
    }
    const labels = {
      updated: "已更新",
      cached: "已有最新数据",
      not_published: "尚未公布",
      error: "同步失败",
    };
    const describe = (r: SyncResult) =>
      `${r.year} ${r.kind === "official" ? "放假安排" : "节日日期"}：${labels[r.status]}${r.error ? `（${r.error}）` : ""}`;
    const failures = results.filter((r) => r.status === "error").map(describe);
    const error = failures.length ? failures.join("；") : null;
    await ctx.db.run(
      "INSERT INTO {maintenance}(job,day,error) VALUES (?,?,?) ON CONFLICT(job) DO UPDATE SET day=excluded.day,error=excluded.error WHERE day<>excluded.day OR error IS NOT excluded.error",
      jobKey,
      day,
      error,
    );
    return {
      ok: !error,
      message:
        job === "cleanup" ? "清理完成" : results.map(describe).join("；"),
      results,
    };
  } catch (e) {
    await ctx.db.run(
      "INSERT INTO {maintenance}(job,day,error) VALUES (?,?,?) ON CONFLICT(job) DO UPDATE SET day=excluded.day,error=excluded.error WHERE day<>excluded.day OR error IS NOT excluded.error",
      jobKey,
      day,
      e instanceof Error ? e.message.slice(0, 200) : "maintenance_failed",
    );
    return {
      ok: false,
      message: `维护失败：${e instanceof Error ? e.message : String(e)}`,
      results,
    };
  }
}
