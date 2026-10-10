import { it, expect, vi } from "vitest";
import { database, festivalResponse, start } from "./db.js";
import { install, snapshot } from "../src/data/repository.js";
import { api } from "../src/admin.js";
import { renderCommand } from "../src/commands.js";

it("全新安装后同步在页面和命令中可见；空占位与失败分别显示，恢复后清除错误", async () => {
  const e = database();
  await install(e.ctx);
  let failed = false;
  const fetcher = vi.fn(async (url: string) => {
    if (failed && url.includes("2026.json"))
      return new Response(null, { status: 503 });
    const year = Number(url.match(/(\d{4})(?:\.json)?$/)![1]);
    return Response.json(
      url.includes("uapis.cn")
        ? festivalResponse(year)
        : {
            year,
            papers: [],
            days:
              year === 2026
                ? [
                    { name: "国庆节", date: "2026-10-01", isOffDay: true },
                    { name: "国庆节", date: "2026-10-07", isOffDay: true },
                    { name: "国庆节", date: "2026-10-10", isOffDay: false },
                  ]
                : [],
          },
    );
  });
  const clock = vi.spyOn(Date, "now").mockReturnValue(start);
  vi.stubGlobal("fetch", fetcher);
  const request = (action: string, data?: unknown) =>
    api({
      ctx: e.ctx,
      authenticated: true,
      params: { action },
      request: new Request(
        "https://test/" + action,
        data === undefined
          ? {}
          : {
              method: "POST",
              body: JSON.stringify(data),
            },
      ),
    });
  try {
    const before = e.metrics.queries;
    const first = (await (
      await request("maintenance", { job: "sync" })
    ).json()) as any;
    expect(first.ok).toBe(true);
    expect(first.results.map((r: any) => r.status)).toEqual([
      "updated",
      "updated",
      "not_published",
      "updated",
    ]);
    expect(e.metrics.queries - before).toBeLessThanOrEqual(40);
    const state = (await (await request("state")).json()) as any;
    expect(state.config.holidays.some((h: any) => h.kind === "holiday")).toBe(
      true,
    );
    expect(state.config.holidays.some((h: any) => h.kind === "makeup")).toBe(
      true,
    );
    expect(state.config.festivals).toHaveLength(14);
    expect(state.supplementalFestivalIds).not.toContain(
      "festival-2026-national",
    );
    expect(state.supplementalFestivalIds).toContain("festival-2027-national");
    expect(
      state.sources.find((s: any) => s.kind === "official" && s.year === 2027),
    ).toMatchObject({ hasData: false, error: "not_published" });
    expect(
      (await renderCommand(e.ctx, "假期 下一个", undefined, start)).text,
    ).toContain("2027-01-01（节日日期");
    failed = true;
    const failure = (await (
      await request("maintenance", { job: "sync" })
    ).json()) as any;
    expect(failure.ok).toBe(false);
    expect(failure.message).toContain("2026 放假安排：同步失败（HTTP_503）");
    expect(failure.results).toHaveLength(4);
    expect((await snapshot(e.db)).config.holidays).toEqual(
      state.config.holidays,
    );
    expect(
      await e.db.first("SELECT error FROM {maintenance} WHERE job='sync'"),
    ).toMatchObject({ error: expect.stringContaining("HTTP_503") });
    failed = false;
    expect(
      ((await (await request("maintenance", { job: "sync" })).json()) as any)
        .ok,
    ).toBe(true);
    expect(
      await e.db.first("SELECT error FROM {maintenance} WHERE job='sync'"),
    ).toEqual({ error: null });
    expect(e.send).not.toHaveBeenCalled();
  } finally {
    clock.mockRestore();
    vi.unstubAllGlobals();
  }
});
