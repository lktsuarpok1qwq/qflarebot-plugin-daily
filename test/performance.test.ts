import { it, expect } from "vitest";
import { fixture, start, dueTime } from "./db.js";
import { renderCommand } from "../src/commands.js";
import { dispatch } from "../src/scheduler/dispatcher.js";
import { api } from "../src/admin.js";
import { snapshot } from "../src/data/repository.js";

it("帮助只读取配置，普通文字发送无需解析假期源", async () => {
  const e = await fixture();
  await e.db.run(
    "INSERT INTO {sources}(year,hash,data,error,updated_at) VALUES (2026,'','invalid',NULL,0)",
  );
  for (const name of ["每日", "每日 帮助", "假期", "假期 帮助"] as const) {
    const before = { ...e.metrics };
    expect((await renderCommand(e.ctx, name, undefined, start)).text).not.toBe(
      "",
    );
    expect(e.metrics.queries - before.queries).toBe(1);
    expect(e.metrics.changes).toBe(before.changes);
  }
  await dispatch(e.ctx, () => dueTime + 1000);
  expect(e.send).toHaveBeenCalledExactlyOnceWith(
    { scene: "group", id: "openid0" },
    { markdown: { content: "你好 2026-10-10" } },
  );
  await expect(
    renderCommand(e.ctx, "假期 下一个", undefined, start),
  ).rejects.toThrow();
});

it("原样保存零写入，实际编辑仍发布配置并拒绝过期版本", async () => {
  const e = await fixture(5),
    s = await snapshot(e.db);
  const save = (config: typeof s.config) =>
    api({
      ctx: e.ctx,
      params: { action: "config" },
      authenticated: true,
      request: new Request("https://test/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revision: s.revision, config }),
      }),
    });
  const before = { ...e.metrics };
  const unchanged = await save(s.config);
  expect(unchanged.status).toBe(200);
  expect(await unchanged.json()).toEqual({ revision: s.revision });
  expect(e.metrics.queries - before.queries).toBe(1);
  expect(e.metrics.changes).toBe(before.changes);
  const edited = structuredClone(s.config);
  edited.replies["每日"].body = "新的帮助";
  expect((await save(edited)).status).toBe(200);
  expect((await snapshot(e.db)).config.replies["每日"].body).toBe("新的帮助");
  expect((await save(s.config)).status).toBe(400);
});
