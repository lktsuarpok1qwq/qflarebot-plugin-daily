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
export async function hash(text: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
export async function limitedJson(res: Response, maxBytes = 128_000) {
  if (!res.body) throw new Error("假期源为空");
  const reader = res.body.getReader();
  let size = 0,
    text = "";
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("假期源过大");
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally {
    await reader.cancel();
  }
}
export async function syncYear(
  ctx: Ctx,
  year: number,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
) {
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
      return;
    }
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const value = validateYear(await limitedJson(res), year),
      data = JSON.stringify(value),
      digest = await hash(data);
    if (!hasCalendar(data)) {
      await setError(ctx, year, "not_published", now);
      return;
    }
    if (previous?.hash === digest) {
      if (previous.error)
        await ctx.db.run(
          "UPDATE {sources} SET error=NULL,updated_at=? WHERE year=? AND kind='official'",
          now,
          year,
        );
      return;
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
  } catch (e) {
    await setError(
      ctx,
      year,
      e instanceof Error ? e.message.slice(0, 200) : "sync_failed",
      now,
    );
  }
}
export async function setError(
  ctx: Ctx,
  year: number,
  error: string,
  now: number,
  kind: "official" | "festival" = "official",
) {
  await ctx.db.run(
    "INSERT INTO {sources}(year,hash,data,error,updated_at,kind) VALUES (?,'','',?,?,?) ON CONFLICT(kind,year) DO UPDATE SET error=excluded.error WHERE error IS NOT excluded.error",
    year,
    error,
    now,
    kind,
  );
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
    if (!r.changes) return;
  }
  try {
    // Changed sources rebuild the calendar when published. Only daily cleanup
    // and a manual refresh need to rebuild an unchanged cache.
    if (job === "cleanup" || manual) await refreshCalendar(ctx, scheduledAt);
    if (job === "sync") {
      const year = +day.slice(0, 4);
      for (const y of yearOffset === undefined
        ? [year, year + 1]
        : [year + yearOffset])
        if (y >= 2000 && y <= 2199) {
          if (sourceKind !== "festival")
            await syncYear(ctx, y, fetch, scheduledAt);
          if (sourceKind !== "official")
            await syncFestivals(ctx, y, fetch, scheduledAt, manual);
        }
    } else {
      const s = await snapshot(ctx.db);
      await ctx.db.run(
        "DELETE FROM {deliveries} WHERE key IN (SELECT key FROM {deliveries} WHERE updated_at<? AND status<>'sending' ORDER BY updated_at LIMIT 200)",
        Date.now() - s.config.retentionDays * 86_400_000,
      );
    }
    await ctx.db.run(
      "UPDATE {maintenance} SET error=NULL WHERE job=? AND error IS NOT NULL",
      jobKey,
    );
  } catch (e) {
    await ctx.db.run(
      "INSERT INTO {maintenance}(job,day,error) VALUES (?,?,?) ON CONFLICT(job) DO UPDATE SET error=excluded.error WHERE error IS NOT excluded.error",
      jobKey,
      day,
      e instanceof Error ? e.message.slice(0, 200) : "maintenance_failed",
    );
  }
}
