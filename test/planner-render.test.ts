import { it, expect, vi } from "vitest";
import { fixture, start, dueTime } from "./db.js";
import { nextPlan } from "../src/scheduler/planner.js";
import { renderMessage } from "../src/content/renderer.js";
import { validateConfig } from "../src/data/validation.js";
import { createRenderContext, modules } from "../src/modules/index.js";

it("周计划和一次性日期边界；拒绝互斥字段和未知占位符", async () => {
  expect(
    nextPlan({ kind: "once", date: "2026-10-10", time: "09:00" }, dueTime),
  ).toBeNull();
  expect(
    nextPlan({ kind: "weekly", weekdays: [1, 3], time: "09:00" }, start)?.due,
  ).toBe(Date.parse("2026-10-12T09:00:00+08:00"));
  const { config } = await fixture();
  expect(() => validateConfig(config)).not.toThrow();
  const conflicting = structuredClone(config);
  Object.assign(conflicting.tasks[0]!.schedule, { weekdays: [1] });
  expect(() => validateConfig(conflicting)).toThrow();
  config.tasks[0]!.body = "{{unknown}}";
  expect(() => validateConfig(config)).toThrow("未知变量");
});
it("模板决定换行和格式；模块按需计算一次，覆盖文案不重复转义", async () => {
  const { config } = await fixture();
  const task = config.tasks[0]!,
    b = config.bindings[0]!;
  const spy = vi.spyOn(modules[0]!, "resolve");
  try {
    const resolve = createRenderContext(config, [], dueTime);
    task.body = "开头\n\n{{日期}}\n";
    expect(
      (await renderMessage(task, b, config, dueTime, [], resolve)).text,
    ).toBe("开头\n\n2026-10-10\n");
    expect(spy).not.toHaveBeenCalled();
    task.body = "# 公告\n{{假期.概览}}\n{{假期.今日}}";
    config.holidayCopy.unknown = "**暂无安排**";
    const output = await renderMessage(task, b, config, dueTime, [], resolve);
    expect(output.text).toBe("# 公告\n**暂无安排**\n**暂无安排**");
    b.overrideText = "专属：{{假期.概览}}";
    expect(
      (await renderMessage(task, b, config, dueTime, [], resolve)).text,
    ).toBe("专属：**暂无安排**");
    expect(spy).toHaveBeenCalledTimes(1);
  } finally {
    spy.mockRestore();
  }
});
