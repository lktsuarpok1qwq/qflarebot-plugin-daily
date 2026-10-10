import { describe, it, expect } from "vitest";
import { defaults } from "../src/content/templates.js";
import { nextPlan, dateAt, at, validDate } from "../src/scheduler/planner.js";
import { renderMessage } from "../src/content/renderer.js";
import { holidayService } from "../src/content/holiday.js";
import { importHolidays } from "../src/data/importer.js";
import { validateConfig } from "../src/data/validation.js";
import { validateYear } from "../src/data/holiday-cn.js";
import { fixture, dueTime } from "./db.js";
describe("北京时间与边界", () => {
  it("UTC日期与北京时间跨日", () =>
    expect(dateAt(Date.parse("2026-10-09T16:00:00Z"))).toBe("2026-10-10"));
  it("严格未来，不恢复当前分钟", () =>
    expect(
      nextPlan({ kind: "daily", time: "09:00" }, dueTime, defaults())?.due,
    ).toBe(dueTime + 86400000));
  it("2月29日跳到下一个闰年", () =>
    expect(
      nextPlan(
        { kind: "yearly", time: "09:00", monthDay: "02-29" },
        dueTime,
        defaults(),
      )?.due,
    ).toBe(at("2028-02-29", "09:00")));
  it("不存在的日期不会归一化", () =>
    expect(validDate("2026-02-29")).toBe(false));
  it("已过期的一次性任务没有未来计划", () =>
    expect(
      nextPlan(
        { kind: "once", date: "2026-10-10", time: "09:00" },
        dueTime + 1,
        defaults(),
      ),
    ).toBeNull());
  it("多星期选择", () =>
    expect(
      dateAt(
        nextPlan(
          { kind: "weekly", time: "09:00", weekdays: [1, 3] },
          dueTime,
          defaults(),
        )!.due,
      ),
    ).toBe("2026-10-12"));
});
describe("渲染和校验", () => {
  it("覆盖作用于最终消息且支持变量", async () => {
    const { config } = await fixture();
    config.bindings[0]!.overrideText = "专属 {{date.today}}";
    expect(
      (
        await renderMessage(
          config.tasks[0]!,
          config.bindings[0]!,
          config,
          dueTime,
        )
      ).text,
    ).toBe("专属 2026-10-10");
  });
  it("标题不能使空汇总有效", async () => {
    const { config } = await fixture();
    config.tasks[0]!.title = "日报";
    config.contents[0]!.enabled = false;
    const r = await renderMessage(
      config.tasks[0]!,
      config.bindings[0]!,
      config,
      dueTime,
    );
    expect(r.text).toBe("");
    expect(r.items[0]?.reason).toBe("disabled");
  });
  it("未知假期变量产生明确空原因", async () => {
    const { config } = await fixture();
    config.contents[0]!.body = "{{holiday.next_name}}";
    const r = await renderMessage(
      config.tasks[0]!,
      config.bindings[0]!,
      config,
      dueTime,
    );
    expect(r.items[0]?.reason).toBe("holiday_data_unknown");
  });
  it("未知变量、汇总预算超长不能保存", async () => {
    const { config } = await fixture();
    config.contents[0]!.body = "{{arbitrary.code}}";
    expect(() => validateConfig(config)).toThrow("未知变量");
    config.contents[0]!.body = "字".repeat(500);
    config.tasks[0]!.title = "标题";
    expect(() => validateConfig(config)).toThrow("长度");
  });
  it("拒绝重复平台目标", async () => {
    const { config } = await fixture();
    config.recipients.push({ ...config.recipients[0]!, id: "other" });
    expect(() => validateConfig(config)).toThrow("重复");
  });
});
describe("假期状态与导入", () => {
  it("无数据为unknown而非none", async () =>
    expect(
      (await holidayService(defaults(), [], dueTime).getNextHoliday()).status,
    ).toBe("unknown"));
  it("完整年度没有假期为none", async () => {
    const c = defaults();
    const raw = [2026, 2027].map((year) => ({
      year,
      hash: "",
      data: '{"days":[]}',
      error: null,
      updated_at: 0,
    }));
    expect(
      (await holidayService(c, raw, dueTime).getNextHoliday()).status,
    ).toBe("none");
  });
  it("手动录入无需来源网址或年度确认，保存后直接可查", async () => {
    const c = defaults();
    c.holidays = [
      {
        id: "h",
        name: "假期",
        start: "2026-10-01",
        end: "2026-10-12",
        kind: "holiday",
        source: "",
      },
    ];
    validateConfig(c);
    const q = await holidayService(c, [], dueTime).getNextHoliday();
    expect(q.status).toBe("known");
    expect(q.data?.id).toBe("h");
    expect(q.coverage.complete).toBe(false);
  });
  it("跨年区间保留原日期", async () => {
    const c = defaults();
    c.holidays = [
      {
        id: "h",
        name: "跨年",
        start: "2026-12-30",
        end: "2027-01-03",
        kind: "holiday",
        source: "https://www.gov.cn/a",
      },
    ];
    const q = await holidayService(c).getRemainingHolidays(2027, "2027-01-01");
    expect(q.data[0]?.start).toBe("2026-12-30");
  });
  it("已同步年度可直接判断普通工作日", async () => {
    const raw = [
      { year: 2026, hash: "", data: '{"days":[]}', error: null, updated_at: 0 },
    ];
    expect(
      (await holidayService(defaults(), raw).getDayStatus("2026-10-12")).data
        .kind,
    ).toBe("workday");
  });
  it("CSV 引号、重复和重叠预览", () => {
    const r = importHolidays(
      'name,start,end\n"节日,一",2026-10-01,2026-10-03\n另一个,2026-10-02,2026-10-04\n另一个,2026-10-02,2026-10-04',
      [],
    );
    expect(r.items).toHaveLength(2);
    expect(r.conflicts).toHaveLength(1);
    expect(r.duplicates).toBe(1);
  });
  it("恶意和错误源被拒绝", () => {
    expect(() =>
      validateYear(
        { year: 2026, papers: ["https://evil.test"], days: [] },
        2026,
      ),
    ).toThrow();
    expect(() =>
      importHolidays('[{"name":"错误","start":"2026-02-30"}]', []),
    ).toThrow();
  });
});
