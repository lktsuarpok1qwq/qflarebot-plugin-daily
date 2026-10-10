import { it, expect } from "vitest";
import { fixture, dueTime, start } from "./db.js";
import { dispatch } from "../src/scheduler/dispatcher.js";
import { snapshot, saveConfig } from "../src/data/repository.js";
import { api } from "../src/admin.js";
import { renderCommand } from "../src/commands.js";
it("群聊私聊共享Markdown公告，整条覆盖独立渲染，长文案不截断", async () => {
  const e = await fixture(3),
    s = await snapshot(e.db);
  const body = "**" + "正文".repeat(600) + "** {{日期}}";
  s.config.tasks[0]!.body = body;
  s.config.bindings[2]!.overrideText = "独立内容";
  await saveConfig(e.ctx, s, s.config, start);
  await dispatch(e.ctx, () => dueTime + 1000);
  expect(e.send).toHaveBeenCalledTimes(3);
  const messages = e.send.mock.calls.map((c) => c[1]);
  expect(messages).toEqual([
    { markdown: { content: body.replace("{{日期}}", "2026-10-10") } },
    { markdown: { content: body.replace("{{日期}}", "2026-10-10") } },
    { markdown: { content: "独立内容" } },
  ]);
});
it("未绑定公告也能预览；模块命令独立文案使用同一缓存", async () => {
  const e = await fixture(),
    s = await snapshot(e.db);
  s.config.bindings = [];
  s.config.tasks[0]!.body = "{{假期.概览}}";
  const res = await api({
    ctx: e.ctx,
    authenticated: true,
    params: { action: "preview" },
    request: new Request("https://test/preview", {
      method: "POST",
      body: JSON.stringify({ config: s.config, taskId: "task" }),
    }),
  });
  expect(res.status).toBe(200);
  expect(e.send).not.toHaveBeenCalled();
  s.config.replies["假期 下一个"].unknown = "明年安排未知";
  expect(
    (await renderCommand(e.ctx, "假期 下一个", s.config, start, [])).text,
  ).toBe("明年安排未知");
});
it("发送成功但结果落库失败，后续收敛为不确定且不重发", async () => {
  const e = await fixture();
  e.send.mockImplementationOnce(async () => {
    e.failNextBatch();
    return { ok: true, status: 200, messageId: "sent", raw: null };
  });
  await dispatch(e.ctx, () => dueTime + 1000);
  await dispatch(e.ctx, () => dueTime + 90000);
  expect(e.send).toHaveBeenCalledTimes(1);
  expect(await e.db.first("SELECT status FROM {deliveries}")).toEqual({
    status: "uncertain",
  });
});
