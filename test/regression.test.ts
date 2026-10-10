import plugin from "../src/index.js";
import { queryHoliday } from "../src/commands.js";
import { describe, it, expect, vi } from "vitest";
import { fixture, database, start, dueTime } from "./db.js";
import { dispatch } from "../src/scheduler/dispatcher.js";
import {
  saveConfig,
  snapshot,
  due,
  claim,
  install,
  progress,
} from "../src/data/repository.js";
import {
  exportBackup,
  restoreBackup,
  verifyBackup,
} from "../src/data/backup.js";
import { maintenance, syncYear, hash } from "../src/data/holiday-cn.js";
import { validateConfig } from "../src/data/validation.js";
import { holidayService } from "../src/content/holiday.js";
import { api } from "../src/admin.js";
import { importHolidays } from "../src/data/importer.js";
import { nextPlan } from "../src/scheduler/planner.js";
import { defaults } from "../src/content/templates.js";
import type { Holiday } from "../src/types.js";
const holiday = (id: string, date = "2026-10-10"): Holiday => ({
  id,
  name: id,
  start: date,
  end: date,
  kind: "holiday",
  source: "https://www.gov.cn/test",
});
const invoke = (
  ctx: Awaited<ReturnType<typeof fixture>>["ctx"],
  action: string,
  data: unknown,
) =>
  api({
    ctx,
    params: { action },
    authenticated: true,
    request: new Request("https://test/p/daily/api/" + action, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    }),
  });
async function events(count = 1) {
  const e = await fixture(count),
    s = await snapshot(e.db),
    c = structuredClone(s.config);
  c.holidays = [holiday("a"), holiday("b")];
  c.contents[0]!.body = "{{holiday.next_name}}";
  c.tasks[0]!.schedule = {
    kind: "holiday_event",
    time: "09:00",
    eventKind: "holiday",
    offset: 0,
  };
  await saveConfig(e.ctx, s, c, start);
  return e;
}

describe("调度、SDK 共享预算及并发", () => {
  it("发送五个目标与一个年度发布同轮完成，给宿主留出查询余量", async () => {
    const e = await fixture(5),
      before = e.metrics.queries;
    vi.stubGlobal("fetch", async (url: string) =>
      Response.json({
        year: Number(url.match(/(\d{4})\.json$/)![1]),
        papers: [],
        days: [],
      }),
    );
    try {
      await dispatch(e.ctx, () => dueTime + 1000);
      await maintenance(e.ctx, "sync", dueTime, false, 0);
      expect(e.send).toHaveBeenCalledTimes(5);
      expect(e.metrics.queries - before).toBeLessThanOrEqual(30);
      expect(await e.db.all("SELECT year FROM {sources}")).toEqual([
        { year: 2026 },
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("重启后的过期游标成批推进，不饿死新到期任务", async () => {
    const e = await fixture(5),
      before = e.metrics.queries;
    await e.db.run(
      "UPDATE {bindings} SET due_at=due_at-86400000 WHERE recipient_id<>'r0'",
    );
    await dispatch(e.ctx, () => dueTime + 1000);
    expect(e.send).toHaveBeenCalledTimes(5);
    expect(await due(e.db, dueTime + 1000)).toHaveLength(0);
    expect(e.metrics.queries - before).toBeLessThan(30);
  });
  it("个人配置不做提前容量拦截，实际调度仍遵守每轮上限", async () => {
    const e = await fixture(6),
      s = await snapshot(e.db);
    const clock = vi.spyOn(Date, "now").mockReturnValue(start);
    try {
      expect(
        (
          await invoke(e.ctx, "config", {
            revision: s.revision,
            config: s.config,
          })
        ).status,
      ).toBe(200);
    } finally {
      clock.mockRestore();
    }
    await dispatch(e.ctx, () => dueTime + 1000);
    expect(e.send).toHaveBeenCalledTimes(5);
    expect(
      await e.db.first(
        "SELECT COUNT(*) AS n FROM {deliveries} WHERE status='skipped_budget'",
      ),
    ).toEqual({ n: 1 });
  });
  it("同刻假期共用消息，全部记录防重进度", async () => {
    const e = await events();
    await dispatch(e.ctx, () => dueTime + 1000);
    expect(e.send).toHaveBeenCalledTimes(1);
    expect(e.send.mock.calls[0]![1]).toEqual({ text: "a / b" });
    expect(
      await e.db.all(
        "SELECT event_key FROM {event_progress} ORDER BY event_key",
      ),
    ).toEqual([{ event_key: "a:0" }, { event_key: "b:0" }]);
    expect(await due(e.db, dueTime + 1000)).toHaveLength(0);
  });
  it("不同目标已有不同进度时，渲染缓存不会串用已提醒的事件", async () => {
    const e = await events(2);
    await e.db.run(
      "INSERT INTO {event_progress}(binding_id,event_key) VALUES ('task:r0','a:0')",
    );
    await dispatch(e.ctx, () => dueTime + 1000);
    const messages = e.send.mock.calls.map((call) => call[1]);
    expect(messages).toContainEqual({ text: "b" });
    expect(messages).toContainEqual({ text: "a / b" });
  });
  it("发送期间修改假期日期，旧认领完成后仍不能重发同一事件", async () => {
    const e = await events();
    e.send.mockImplementationOnce(async () => {
      const s = await snapshot(e.db),
        c = structuredClone(s.config);
      for (const h of c.holidays) h.start = h.end = "2026-10-11";
      await saveConfig(e.ctx, s, c, dueTime + 1000);
      return { ok: true, status: 200, messageId: "sent", raw: null };
    });
    await dispatch(e.ctx, () => dueTime + 1000);
    await dispatch(e.ctx, () => dueTime + 86400000 + 1000);
    expect(e.send).toHaveBeenCalledTimes(1);
  });
  it("保存配置时调度已推进的游标不会倒退，即使详细日志已清理", async () => {
    const e = await fixture(),
      s = await snapshot(e.db),
      c = structuredClone(s.config),
      all = e.db.all.bind(e.db);
    let intercept = true;
    e.db.all = async (sql, ...params) => {
      const result = await all(sql, ...params);
      if (intercept && sql.includes("SELECT id,enabled,due_at")) {
        intercept = false;
        await dispatch(e.ctx, () => dueTime + 1000);
        await e.db.run("DELETE FROM {deliveries}");
      }
      return result as never;
    };
    c.help.daily = "修改帮助";
    await saveConfig(e.ctx, s, c, dueTime + 2000);
    expect(await e.db.first("SELECT due_at FROM {bindings}")).toEqual({
      due_at: dueTime + 86400000,
    });
    await dispatch(e.ctx, () => dueTime + 3000);
    expect(e.send).toHaveBeenCalledTimes(1);
  });
  it("已有超过100个中断事件绑定读取防重进度不超过D1参数上限", async () => {
    const e = await fixture();
    expect(
      (
        await progress(
          e.db,
          Array.from({ length: 105 }, (_, i) => "task:r" + i),
        )
      ).size,
    ).toBe(0);
  });
  it("批量结果持久化失败，不重发；恢复时全部事件记为不确定", async () => {
    const e = await events();
    e.send.mockImplementationOnce(async () => {
      e.failNextBatch();
      return { ok: true, status: 200, messageId: "sent", raw: null };
    });
    await dispatch(e.ctx, () => dueTime + 1000);
    await dispatch(e.ctx, () => dueTime + 90000);
    expect(e.send).toHaveBeenCalledTimes(1);
    expect(
      await e.db.all("SELECT event_key FROM {event_progress}"),
    ).toHaveLength(2);
    expect(await e.db.first("SELECT status FROM {deliveries}")).toEqual({
      status: "uncertain",
    });
  });
  it("慢调用跨过39秒预留线时不再开始新请求", async () => {
    const e = await fixture(5);
    let now = dueTime + 1000;
    e.send.mockImplementation(async () => {
      now = dueTime + 40000;
      return { ok: true, status: 200, messageId: "sent", raw: null };
    });
    await dispatch(e.ctx, () => now);
    expect(e.send.mock.calls.length).toBeLessThanOrEqual(2);
    expect(await due(e.db, now)).toHaveLength(0);
  });
});

describe("假期语义、来源和输入边界", () => {
  it("跨年度文件有更正时采用较新年度的数据", async () => {
    const e = database();
    await install(e.ctx);
    const year = (year: number, isOffDay: boolean) => ({
      year,
      papers: [],
      days: [{ date: "2026-01-02", name: "X", isOffDay }],
    });
    await syncYear(e.ctx, 2025, async () => Response.json(year(2025, false)));
    await syncYear(e.ctx, 2026, async () => Response.json(year(2026, true)));
    expect((await snapshot(e.db)).config.holidays).toHaveLength(0);
    await syncYear(e.ctx, 2026, async () => Response.json(year(2026, false)));
    expect((await snapshot(e.db)).config.holidays[0]?.kind).toBe("makeup");
  });
  it("非法CSV、列数、控制字符拒绝；BOM JSON允许", () => {
    expect(() => importHolidays('name,start\na"b,2026-10-10', [])).toThrow(
      "CSV",
    );
    expect(() => importHolidays("name,start\na,2026-10-10,extra", [])).toThrow(
      "列数",
    );
    expect(
      importHolidays('\uFEFF[{"name":"A","start":"2026-10-10"}]', []).items,
    ).toHaveLength(1);
    const c = defaults();
    c.holidays = [{ ...holiday("a"), name: "bad\x01" }];
    expect(() => validateConfig(c)).toThrow();
  });
  it("未知变量包括原型属性都拒绝，支持日期上界不越界", () => {
    const c = defaults();
    c.contents = [
      {
        id: "c",
        name: "C",
        enabled: true,
        kind: "text",
        body: "{{constructor}}",
      },
    ];
    expect(() => validateConfig(c)).toThrow("未知变量");
    expect(
      nextPlan(
        { kind: "daily", time: "09:00" },
        Date.parse("2199-12-31T09:00:00+08:00"),
        defaults(),
      ),
    ).toBeNull();
  });
});

describe("备份与管理接口", () => {
  it("多分块恢复不会删掉前一块源，并保留本地更晚的防重记录", async () => {
    const e = await fixture(),
      b = await exportBackup(e.ctx);
    const long = "字".repeat(80);
    for (let year = 2000; year < 2011; year++) {
      const days = Array.from({ length: 365 }, (_, i) => ({
        date: new Date(Date.UTC(year, 0, i + 1)).toISOString().slice(0, 10),
        name: long,
        isOffDay: true,
      }));
      const data = JSON.stringify({ year, papers: [], days });
      b.sources.push({
        year,
        hash: await hash(data),
        data,
        error: null,
        updated_at: 0,
      });
    }
    b.progress = Array.from({ length: 9000 }, (_, i) => ({
      binding_id: "task:r0",
      event_key: `event${i}:0`,
    }));
    await e.db.run("INSERT INTO {event_progress} VALUES ('task:r0','later:0')");
    const before = e.metrics.queries;
    await restoreBackup(e.ctx, b, (await snapshot(e.db)).revision);
    expect(e.metrics.queries - before).toBeLessThan(30);
    expect(await e.db.all("SELECT year FROM {sources}")).toHaveLength(11);
    expect((await exportBackup(e.ctx)).progress).toHaveLength(9001);
  });
  it("恢复空源确实删除旧源，错误指纹及目标身份替换拒绝", async () => {
    const e = await fixture(),
      b = await exportBackup(e.ctx);
    await syncYear(e.ctx, 2026, async () =>
      Response.json({ year: 2026, papers: [], days: [] }),
    );
    await restoreBackup(e.ctx, b, (await snapshot(e.db)).revision);
    expect(await e.db.all("SELECT * FROM {sources}")).toHaveLength(0);
    b.sources = [
      {
        year: 2026,
        hash: "0".repeat(64),
        data: '{"year":2026,"papers":[],"days":[]}',
        error: null,
        updated_at: 0,
      },
    ];
    await expect(verifyBackup(b)).rejects.toThrow("指纹");
    b.sources = [];
    b.config.recipients[0]!.openid = "different";
    await expect(
      restoreBackup(e.ctx, b, (await snapshot(e.db)).revision),
    ).rejects.toThrow("身份");
  });
  it("JSON结构错误不会发送，修改已有目标身份也被拦截", async () => {
    const e = await fixture();
    expect((await invoke(e.ctx, "config", null)).status).toBe(400);
    expect(e.send).not.toHaveBeenCalled();
    const s = await snapshot(e.db);
    s.config.recipients[0]!.openid = "changed";
    expect(
      (
        await invoke(e.ctx, "config", {
          revision: s.revision,
          config: s.config,
        })
      ).status,
    ).toBe(400);
  });
  it("无需启用或额外确认即可测试，重复请求仍只发送一次", async () => {
    const e = await fixture(),
      s = await snapshot(e.db);
    s.config.tasks[0]!.enabled = false;
    s.config.recipients[0]!.enabled = false;
    s.config.bindings[0]!.enabled = false;
    await saveConfig(e.ctx, s, s.config, start);
    const data = {
      taskId: "task",
      recipientId: "r0",
      requestId: crypto.randomUUID(),
    };
    expect((await invoke(e.ctx, "preview", data)).status).toBe(200);
    expect(e.send).not.toHaveBeenCalled();
    expect((await invoke(e.ctx, "test", data)).status).toBe(200);
    const duplicate = (await (await invoke(e.ctx, "test", data)).json()) as {
      duplicate: boolean;
    };
    expect(duplicate.duplicate).toBe(true);
    expect(e.send).toHaveBeenCalledTimes(1);
    expect((await snapshot(e.db)).config.tasks[0]!.enabled).toBe(false);
  });
  it("认领后暂停取消尚未发起的发送，之后收敛不补发", async () => {
    const e = await fixture(3),
      first = e.db.first.bind(e.db);
    let pause: Promise<unknown> | undefined;
    e.db.first = async (sql, ...params) => {
      if (sql === "SELECT revision FROM {state} WHERE id=1") {
        pause ??= (async () => {
          const s = await snapshot(e.db),
            c = structuredClone(s.config);
          c.paused = true;
          await saveConfig(e.ctx, s, c, dueTime + 1000);
        })();
        await pause;
      }
      return first(sql, ...params) as never;
    };
    await dispatch(e.ctx, () => dueTime + 1000);
    expect(e.send).not.toHaveBeenCalled();
    expect(
      (
        await e.db.all<{ status: string }>("SELECT status FROM {deliveries}")
      ).every((r) => r.status === "skipped_disabled"),
    ).toBe(true);
  });
});

it("最大绑定和同刻事件规模使用有界 SQL 参数，全部事件进度持久化", async () => {
  const e = await fixture(5),
    s = await snapshot(e.db),
    c = structuredClone(s.config);
  c.holidays = Array.from({ length: 600 }, (_, i) =>
    holiday(("holiday" + i).padEnd(70, "x")),
  );
  c.tasks = Array.from({ length: 20 }, (_, i) => ({
    ...c.tasks[0]!,
    id: "t" + i,
    schedule: {
      kind: "holiday_event" as const,
      time: "09:" + String(i).padStart(2, "0"),
      eventKind: "holiday" as const,
      offset: 0,
    },
  }));
  c.bindings = c.tasks.flatMap((t) =>
    c.recipients.map((r) => ({
      taskId: t.id,
      recipientId: r.id,
      enabled: true,
      overrideText: null,
    })),
  );
  validateConfig(c);
  const before = e.metrics.queries;
  await saveConfig(e.ctx, s, c, start);
  expect(e.metrics.queries - before).toBeLessThan(20);
  await dispatch(e.ctx, () => dueTime + 1000);
  expect(e.send).toHaveBeenCalledTimes(5);
  expect(
    await e.db.first("SELECT COUNT(*) AS n FROM {event_progress}"),
  ).toEqual({ n: 3000 });
}, 10_000);

it("人工假期优先于原始补班数据，录入后立即发送且不重复", async () => {
  const e = await events(),
    s = await snapshot(e.db);
  const data = JSON.stringify({
    year: 2026,
    papers: [],
    days: [{ date: "2026-10-10", name: "补班", isOffDay: false }],
  });
  const raw = {
    year: 2026,
    hash: await hash(data),
    data,
    error: null,
    updated_at: 0,
  };
  await e.db.run(
    "INSERT INTO {sources} VALUES (2026,?,?,NULL,0)",
    raw.hash,
    data,
  );
  expect(
    (await holidayService(s.config, [raw]).getDayStatus("2026-10-10")).data
      .kind,
  ).toBe("holiday");
  await dispatch(e.ctx, () => dueTime + 1000);
  await dispatch(e.ctx, () => dueTime + 2000);
  expect(e.send).toHaveBeenCalledTimes(1);
});

it("假期提前提醒绑定当前事件，不会错误渲染尚未开始的另一个假期", async () => {
  const e = await fixture(),
    s = await snapshot(e.db),
    c = structuredClone(s.config);
  c.holidays = [holiday("较早", "2026-10-10"), holiday("本次", "2026-10-12")];
  // Persistable IDs are ASCII, names may contain Chinese.
  c.holidays[0]!.id = "a";
  c.holidays[1]!.id = "b";
  c.tasks[0]!.schedule = {
    kind: "holiday_event",
    eventKind: "holiday",
    time: "09:00",
    offset: 7,
  };
  c.contents[0]!.body = "{{holiday.next_name}}";
  await saveConfig(e.ctx, s, c, Date.parse("2026-10-04T00:00:00+08:00"));
  await dispatch(e.ctx, () => Date.parse("2026-10-05T09:00:01+08:00"));
  expect(e.send.mock.calls[0]![1]).toEqual({ text: "本次" });
});

it("假期源仅调整键和条目顺序时，不修改录入数据也不写数据库", async () => {
  const e = await fixture();
  const days = [
    { name: "甲", date: "2026-10-10", isOffDay: true },
    { name: "乙", date: "2026-10-11", isOffDay: true },
  ];
  const papers = ["https://www.gov.cn/a", "https://www.gov.cn/b"];
  await syncYear(
    e.ctx,
    2026,
    (async () => Response.json({ year: 2026, papers, days })) as typeof fetch,
    start,
  );
  const s = await snapshot(e.db),
    c = structuredClone(s.config);
  c.holidays = [holiday("a")];
  await saveConfig(e.ctx, s, c, start);
  const writes = e.metrics.changes;
  await syncYear(
    e.ctx,
    2026,
    (async () =>
      Response.json({
        days: days
          .toReversed()
          .map((d) => ({ isOffDay: d.isOffDay, date: d.date, name: d.name })),
        papers: [...papers.toReversed(), papers[0]],
        year: 2026,
      })) as typeof fetch,
    start + 1000,
  );
  expect(e.metrics.changes).toBe(writes);
  const saved = await snapshot(e.db);
  expect(saved.config.holidays[0]!.id).toBe("a");
});

it("假期查询最小文字预算仍展示长名称对应日期并保留旧数据提示", async () => {
  const e = await fixture(),
    s = await snapshot(e.db),
    c = structuredClone(s.config);
  c.textLimit = 100;
  c.holidays = [{ ...holiday("a"), name: "长假".repeat(40) }];
  await saveConfig(e.ctx, s, c, start);
  await e.db.run(
    "INSERT INTO {sources}(year,hash,data,error,updated_at) VALUES (2026,'cached',?,'offline',0)",
    JSON.stringify({ year: 2026, papers: [], days: [] }),
  );
  const clock = vi.spyOn(Date, "now").mockReturnValue(start);
  try {
    const text = await queryHoliday(e.ctx, "remaining");
    expect(text).toContain("2026-10-10 至 2026-10-10");
    expect(text).toContain("最近可信版本");
    expect([...text].length).toBeLessThanOrEqual(100);
  } finally {
    clock.mockRestore();
  }
});

it("手动同步按北京时间只请求当年和明年", async () => {
  const e = await fixture();
  const fetched: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    fetched.push(url);
    return Response.json({
      year: Number(url.match(/(\d{4})\.json$/)![1]),
      papers: [],
      days: [],
    });
  });
  try {
    await maintenance(e.ctx, "sync", Date.parse("2026-12-31T16:00:00Z"), true);
    expect(fetched.map((url) => url.match(/(\d{4})\.json$/)![1])).toEqual([
      "2027",
      "2028",
    ]);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("人工调整自动补班日期后，同步保留修改且原日期不再视为补班", async () => {
  const e = await fixture();
  const raw = {
    year: 2026,
    papers: [],
    days: [{ name: "补班", date: "2026-10-10", isOffDay: false }],
  };
  await syncYear(e.ctx, 2026, async () => Response.json(raw), start);
  const s = await snapshot(e.db),
    c = structuredClone(s.config);
  const h = c.holidays[0]!;
  h.name = "我的调整";
  h.start = "2026-10-11";
  h.end = h.start;
  expect(
    (await invoke(e.ctx, "config", { revision: s.revision, config: c })).status,
  ).toBe(200);
  raw.days[0]!.name = "源更新";
  await syncYear(e.ctx, 2026, async () => Response.json(raw), start + 1000);
  const saved = await snapshot(e.db);
  expect(saved.config.holidays).toHaveLength(1);
  expect(saved.config.holidays[0]).toMatchObject({
    id: h.id,
    name: "我的调整",
    start: "2026-10-11",
    manual: true,
  });
  const service = holidayService(saved.config, [
    {
      year: 2026,
      hash: "",
      data: JSON.stringify(raw),
      error: null,
      updated_at: 0,
    },
  ]);
  expect((await service.getDayStatus("2026-10-10")).data.kind).toBe("weekend");
  expect((await service.getDayStatus("2026-10-11")).data.kind).toBe(
    "makeup_workday",
  );
});

it("旧配置升级直接启用原假期，保留事件身份和已处理进度", async () => {
  const e = await fixture(),
    s = await snapshot(e.db);
  const legacy = {
    ...s.config,
    regions: [{ id: "CN", name: "old" }],
    coverage: [],
    holidays: [
      { ...holiday("a"), verified: false, region: "CN" },
      { ...holiday("b", "2026-10-11"), verified: false, region: "CN" },
    ],
  };
  legacy.tasks[0]!.schedule = {
    kind: "holiday_event",
    time: "09:00",
    eventKind: "holiday",
    offset: 0,
  };
  await e.db.run("UPDATE {state} SET config=?", JSON.stringify(legacy));
  await e.db.run("UPDATE {bindings} SET due_at=NULL,event_key=NULL");
  await e.db.run("INSERT INTO {event_progress} VALUES ('task:r0','a:0')");
  const clock = vi.spyOn(Date, "now").mockReturnValue(start);
  try {
    await plugin.hooks!.onBoot!(e.ctx);
  } finally {
    clock.mockRestore();
  }
  const saved = await snapshot(e.db);
  expect(saved.config).not.toHaveProperty("regions");
  expect(saved.config.holidays[0]).not.toHaveProperty("verified");
  expect(await e.db.first("SELECT event_key FROM {bindings}")).toEqual({
    event_key: "b:0",
  });
  expect(await e.db.first("SELECT event_key FROM {event_progress}")).toEqual({
    event_key: "a:0",
  });
});

it("人工录入覆盖自动同日记录时，调度和查询使用同一条有效记录", async () => {
  const e = await fixture(),
    s = await snapshot(e.db),
    c = structuredClone(s.config);
  c.holidays = [
    {
      ...holiday("cn-makeup-2026-10-10"),
      kind: "makeup",
      source: "holiday-cn:2026",
    },
    { ...holiday("manual"), kind: "makeup" },
  ];
  c.tasks[0]!.schedule = {
    kind: "holiday_event",
    eventKind: "makeup",
    offset: 0,
    time: "09:00",
  };
  await saveConfig(e.ctx, s, c, start);
  expect(await e.db.first("SELECT event_key FROM {bindings}")).toEqual({
    event_key: "manual:0",
  });
  await dispatch(e.ctx, () => dueTime + 1000);
  await dispatch(e.ctx, () => dueTime + 2000);
  expect(e.send).toHaveBeenCalledTimes(1);
  expect(await e.db.first("SELECT event_key FROM {event_progress}")).toEqual({
    event_key: "manual:0",
  });
});
