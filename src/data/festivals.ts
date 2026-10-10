import type { Ctx, Festival, Source } from "../types.js";
import { validDate } from "../scheduler/planner.js";
import { snapshot, saveConfig } from "./repository.js";
import { hash, limitedJson, setError } from "./holiday-cn.js";
export const FESTIVALS = {
  newyear: "元旦",
  spring: "春节",
  qingming: "清明节",
  labour: "劳动节",
  dragonboat: "端午节",
  midautumn: "中秋节",
  national: "国庆节",
} as const;
export function festivalIds(name: string, year: number) {
  return Object.entries(FESTIVALS)
    .filter(([, title]) =>
      name.includes(title === "春节" ? title : title.replace(/节$/, "")),
    )
    .map(([key]) => `festival-${year}-${key}`);
}
export type FestivalYear = { year: number; festivals: Festival[] };
export function validateFestivalYear(
  value: unknown,
  year: number,
): FestivalYear {
  const v = value as FestivalYear;
  if (
    !v ||
    v.year !== year ||
    !Array.isArray(v.festivals) ||
    !v.festivals.length ||
    v.festivals.length > 7
  )
    throw new Error("节日日期数据错误");
  const keys = new Set<string>();
  for (const f of v.festivals) {
    if (
      !f ||
      !Object.hasOwn(FESTIVALS, f.key) ||
      keys.has(f.key) ||
      f.name !== FESTIVALS[f.key as keyof typeof FESTIVALS] ||
      !validDate(f.date) ||
      +f.date.slice(0, 4) !== year ||
      f.id !== `festival-${year}-${f.key}` ||
      f.source !== "uapi"
    )
      throw new Error("节日日期字段错误");
    keys.add(f.key);
  }
  return {
    year,
    festivals: [...v.festivals].sort(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    ),
  };
}
export function parseFestivalResponse(
  value: unknown,
  year: number,
): FestivalYear {
  const v = value as {
    query?: { year?: string };
    holidays?: { name: string; date: string; type: string }[];
  };
  if (!v || v.query?.year !== String(year) || !Array.isArray(v.holidays))
    throw new Error("节日日期来源响应错误");
  const festivals: Festival[] = [];
  for (const [key, name] of Object.entries(FESTIVALS)) {
    const days = v.holidays.filter(
      (d) =>
        (d.name === name || (key === "labour" && d.name === "五一劳动节")) &&
        ["solar_festival", "lunar_festival"].includes(d.type),
    );
    if (days.length !== 1) throw new Error("节日日期缺失或重复：" + name);
    festivals.push({
      id: `festival-${year}-${key}`,
      key,
      name,
      date: days[0]!.date,
      source: "uapi",
    });
  }
  return validateFestivalYear({ year, festivals }, year);
}
export async function syncFestivals(
  ctx: Ctx,
  year: number,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
  force = false,
) {
  const previous = await ctx.db.first<Source>(
    "SELECT * FROM {sources} WHERE year=? AND kind='festival'",
    year,
  );
  // Festival dates do not change daily. Retry failed requests on the next sync.
  if (
    !force &&
    previous?.data &&
    !previous.error &&
    now - previous.updated_at < 30 * 86_400_000
  )
    return;
  try {
    const res = await fetcher(
      `https://uapis.cn/api/v1/misc/holiday-calendar?year=${year}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const value = parseFestivalResponse(await limitedJson(res, 256_000), year);
    const data = JSON.stringify(value),
      digest = await hash(data);
    if (previous?.hash === digest) {
      await ctx.db.run(
        "UPDATE {sources} SET error=NULL,updated_at=? WHERE kind='festival' AND year=?",
        now,
        year,
      );
      return;
    }
    const s = await snapshot(ctx.db);
    const config = structuredClone(s.config);
    const keep = config.festivals.filter(
      (f) => f.manual || f.source !== "uapi" || +f.date.slice(0, 4) !== year,
    );
    const ids = new Set(keep.map((f) => f.id));
    config.festivals = [
      ...keep,
      ...value.festivals.filter((f) => !ids.has(f.id)),
    ];
    await saveConfig(ctx, s, config, now, false, undefined, {
      kind: "festival",
      year,
      hash: digest,
      data,
      error: null,
      updated_at: now,
    });
  } catch (e) {
    await setError(
      ctx,
      year,
      e instanceof Error ? e.message.slice(0, 200) : "sync_failed",
      now,
      "festival",
    );
  }
}
