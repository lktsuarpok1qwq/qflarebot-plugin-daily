import type { RouteInput } from "@qqbot/sdk";
import { LIMITS } from "./types.js";
import { COPY } from "./copy.js";
import { snapshot, saveConfig, bindingId, readData } from "./data/repository.js";
import { validateConfig } from "./data/validation.js";
import { exportBackup, parseBackup, restoreBackup, verifyBackup } from "./data/backup.js";
import { importEvents } from "./modules/calendar/importer.js";
import { hasCalendar, refreshDays, restoreEvent, type CalendarYear } from "./modules/calendar/calendar.js";
import { maintenance } from "./data/maintenance.js";
import { defaultReplies, replyVariables, REPLY_FIELDS, COMMAND_NAMES } from "./content/command-templates.js";
import { renderCommand } from "./commands.js";
import { message } from "./content/message.js";
import type { CommandName } from "./types.js";
import { renderMessage } from "./content/renderer.js";
import { jsonRows, jx } from "./data/sql.js";
import { finishMany } from "./data/deliveries.js";
import { resultStatus } from "./scheduler/result.js";
import { VARIABLES } from "./content/templates.js";
import { at, validDate, dateAt } from "./scheduler/planner.js";
async function body(request: Request, limit = LIMITS.bodyBytes + 4096): Promise<Record<string, unknown>> {
    if (Number(request.headers.get("content-length") ?? 0) > limit) {
        throw new Error("请求体过大");
    }

    const reader = request.body?.getReader();

    if (!reader) {
        throw new Error("缺少请求体");
    }

    const chunks: Uint8Array[] = [];
    let size = 0;

    for (;;) {
        const { value, done } = await reader.read();

        if (done) {
            break;
        }

        size += value.byteLength;

        if (size > limit) {
            await reader.cancel();
            throw new Error("请求体过大");
        }

        chunks.push(value);
    }

    const bytes = new Uint8Array(size);
    let pos = 0;

    for (const chunk of chunks) {
        bytes.set(chunk, pos);
        pos += chunk.length;
    }

    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("请求体必须为对象");
    }

    return data as Record<string, unknown>;
}
export async function api({ ctx, request, params, authenticated }: RouteInput): Promise<Response> {
    if (!authenticated) {
        return Response.json({ error: "需要所有者登录" }, { status: 401 });
    }

    try {
        const action = params.action ?? "",
            url = new URL(request.url);

        if (request.method === "GET") {
            if (action === "state") {
                const { snapshot: s, sources: raw } = await readData(ctx.db);
                const [cursors, jobs] = await Promise.all([
                    ctx.db.all(
                        `${jsonRows} SELECT * FROM {bindings} WHERE id IN (SELECT ${jx("id")} FROM idx CROSS JOIN input)`,
                        JSON.stringify(
                            s.config.bindings.map((b) => ({
                                id: bindingId(b.taskId, b.recipientId),
                            })),
                        ),
                    ),
                    ctx.db.all("SELECT * FROM {maintenance} WHERE job NOT LIKE 'calendar:%'"),
                ]);
                return Response.json({
                    ...s,
                    replyDefaults: defaultReplies(),
                    draftDefaults: COPY.drafts,
                    calendarDefaults: COPY.calendar,
                    replyVariables: Object.fromEntries(
                        COMMAND_NAMES.map((name) => [
                            name,
                            Object.fromEntries(REPLY_FIELDS.map((field) => [field, replyVariables(name, field)])),
                        ]),
                    ),
                    currentBotId: ctx.botId,
                    variables: VARIABLES,
                    sources: [0, 1].map((offset) => {
                        const year = +dateAt(Date.now()).slice(0, 4) + offset;
                        const source = raw.find((s) => s.year === year);
                        return {
                            year,
                            updated_at: source?.updated_at ?? 0,
                            checked_at: source?.checked_at ?? 0,
                            refreshDays: refreshDays(source?.data ?? "", offset === 1),
                            references: source?.data
                                ? ((JSON.parse(source.data) as CalendarYear).dates?.length ?? 0)
                                : 0,
                            error: source?.error ?? null,
                            hasData: source ? hasCalendar(source.data) : false,
                        };
                    }),
                    cursors,
                    jobs,
                    limits: LIMITS,
                });
            }

            if (action === "backup") {
                return Response.json(await exportBackup(ctx));
            }

            if (action === "logs") {
                const filter: string[] = [],
                    args: unknown[] = [];

                for (const [key, col] of [
                    ["task", "task_id"],
                    ["recipient", "recipient_id"],
                    ["status", "status"],
                ] as const) {
                    const v = url.searchParams.get(key);

                    if (v) {
                        filter.push(`${col}=?`);
                        args.push(v);
                    }
                }

                const offset = Number(url.searchParams.get("offset") ?? 0);

                if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) {
                    throw new Error("分页参数错误");
                }

                return Response.json(
                    await ctx.db.all(
                        `SELECT * FROM {deliveries}${filter.length ? " WHERE " + filter.join(" AND ") : ""} ORDER BY updated_at DESC,key LIMIT 50 OFFSET ?`,
                        ...args,
                        offset,
                    ),
                );
            }

            throw new Error("未知接口");
        }

        if (request.method !== "POST") {
            return Response.json({ error: "不支持的方法" }, { status: 405 });
        }

        const data = await body(
            request,
            action.startsWith("restore") ? LIMITS.backupBytes + 4096 : LIMITS.bodyBytes + 4096,
        );

        if (action === "maintenance") {
            if (data.job !== "sync" && data.job !== "cleanup") {
                throw new Error("维护类型错误");
            }

            return Response.json(await maintenance(ctx, data.job, Date.now(), true));
        }

        const { snapshot: s, sources: raw } = ["preview", "test", "command-preview", "event-reset"].includes(action)
            ? await readData(ctx.db)
            : { snapshot: await snapshot(ctx.db), sources: [] };

        if (action === "event-reset") {
            if (data.revision !== s.revision) {
                throw new Error("配置已变化，请刷新");
            }

            if (typeof data.id !== "string") {
                throw new Error("请选择日历事件");
            }

            const config = structuredClone(s.config),
                now = Date.now();
            restoreEvent(config, raw, data.id, now);
            validateConfig(config);
            return Response.json({ revision: await saveConfig(ctx, s, config, now) });
        }

        if (action === "config") {
            if (data.revision !== s.revision) {
                throw new Error("配置已变化，请刷新");
            }

            const c = validateConfig(data.config);

            for (const h of c.events) {
                const old = s.config.events.find((x) => x.id === h.id);

                if (old && old.source === "uapi" && JSON.stringify(h) !== JSON.stringify(old)) {
                    h.source = "manual";
                }
            }

            for (const r of c.recipients) {
                const old = s.config.recipients.find((x) => x.id === r.id);

                if (old && (old.scene !== r.scene || old.openid !== r.openid || old.botId !== r.botId)) {
                    throw new Error("目标身份不可修改；请新建目标");
                }

                if (r.enabled && r.botId !== ctx.botId) {
                    throw new Error("不能启用其他机器人的目标");
                }
            }

            for (const t of c.tasks) {
                const old = s.config.tasks.find((x) => x.id === t.id);

                if (
                    t.enabled &&
                    t.schedule.kind === "once" &&
                    (!old || !old.enabled || JSON.stringify(old.schedule) !== JSON.stringify(t.schedule)) &&
                    at(t.schedule.date!, t.schedule.time) <= Date.now()
                ) {
                    throw new Error("一次性任务必须设置未来时间");
                }
            }

            return Response.json({
                revision:
                    s.botId === ctx.botId && JSON.stringify(c) === JSON.stringify(s.config)
                        ? s.revision
                        : await saveConfig(ctx, s, c, Date.now()),
            });
        }

        if (action === "command-preview") {
            const c = validateConfig(data.config);
            const name = data.command as CommandName;

            if (!Object.hasOwn(c.replies, name)) {
                throw new Error("命令错误");
            }

            return Response.json(await renderCommand(ctx, name, c, Date.now(), raw));
        }

        if (action === "preview" || action === "test") {
            const c = data.config ? validateConfig(data.config) : s.config,
                t = c.tasks.find((t) => t.id === data.taskId),
                b = c.bindings.find((b) => b.taskId === data.taskId && b.recipientId === data.recipientId);

            if (!t || (action === "test" && !b)) {
                throw new Error("请选择任务及其绑定目标");
            }

            const when = data.dueAt === undefined ? Date.now() : Number(data.dueAt);

            if (!Number.isFinite(when) || !validDate(dateAt(when))) {
                throw new Error("预览时间错误");
            }

            const rendered = await renderMessage(t, c, when, raw);

            if (action === "preview") {
                return Response.json(rendered);
            }

            if (data.config || s.config.paused || s.botId !== ctx.botId) {
                throw new Error("测试需要已保存的配置且未暂停");
            }

            const r = c.recipients.find((r) => r.id === b!.recipientId)!;

            if (r.botId !== ctx.botId) {
                throw new Error("不能向其他机器人的目标发送");
            }

            if (!rendered.text) {
                throw new Error("测试内容为空");
            }

            // One-time request ID prevents a double click from sending twice.
            if (typeof data.requestId !== "string" || !/^[\w-]{16,80}$/.test(data.requestId)) {
                throw new Error("测试请求标识错误");
            }

            const key = `test:${data.requestId}`,
                now = Date.now();
            const claimed = await ctx.db.run(
                "INSERT OR IGNORE INTO {deliveries}(key,task_id,recipient_id,due_at,revision,status,claimed_at,updated_at,details) SELECT ?,?,?,?,revision,'sending',?,?,? FROM {state} WHERE revision=?",
                key,
                t.id,
                r.id,
                now,
                now,
                now,
                JSON.stringify({ manual: true, ...rendered }),
                s.revision,
            );

            if (!claimed.changes) {
                const prior = await ctx.db.first<{
                    task_id: string;
                    recipient_id: string;
                    status: string;
                    error: string | null;
                    message_id: string | null;
                    details: string | null;
                }>("SELECT task_id,recipient_id,status,error,message_id,details FROM {deliveries} WHERE key=?", key);

                if (!prior || prior.task_id !== t.id || prior.recipient_id !== r.id) {
                    throw new Error("重复测试请求或配置已变化");
                }

                return Response.json({
                    ok: prior.status === "success",
                    status: prior.status,
                    error: prior.error,
                    messageId: prior.message_id,
                    duplicate: true,
                    text: prior.details ? (JSON.parse(prior.details) as { text?: string }).text : undefined,
                });
            }

            const fresh = await snapshot(ctx.db);

            if (fresh.revision !== s.revision) {
                await ctx.db.run("UPDATE {deliveries} SET status='skipped_disabled' WHERE key=?", key);
                throw new Error("配置已变化，取消测试");
            }

            try {
                const result = await ctx.api.sendMessage({ scene: r.scene, id: r.openid }, message(rendered.text));
                await finishMany(ctx.db, [
                    {
                        d: {
                            id: `orphan:${key}`,
                            key,
                            task_id: t.id,
                            recipient_id: r.id,
                            due_at: now,
                            revision: s.revision,
                            status: "sending",
                            claimed_at: now,
                        },
                        ...resultStatus(result),
                        now: Date.now(),
                        next: null,
                    },
                ]);
                return Response.json({
                    ok: result.ok,
                    status: resultStatus(result).status,
                    error: result.error,
                    messageId: result.messageId,
                    text: rendered.text,
                });
            } catch (e) {
                await ctx.db.run(
                    "UPDATE {deliveries} SET status='uncertain',updated_at=?,error=? WHERE key=? AND status='sending'",
                    Date.now(),
                    String(e).slice(0, 300),
                    key,
                );
                throw e;
            }
        }

        if (action === "import-preview") {
            if (typeof data.text !== "string") {
                throw new Error("导入参数错误");
            }

            return Response.json(importEvents(data.text, s.config.events));
        }

        if (action === "restore-preview") {
            const b = await verifyBackup(parseBackup(data.backup, ctx.botId));
            return Response.json({
                revision: s.revision,
                tasks: b.config.tasks.length,
                recipients: b.config.recipients.length,
                enabledTasks: b.config.tasks.filter((t) => t.enabled).length,
                foreign: b.botId !== ctx.botId,
            });
        }

        if (action === "restore") {
            if (data.confirm !== true || typeof data.revision !== "number") {
                throw new Error("请预览并确认恢复");
            }

            return Response.json({
                revision: await restoreBackup(ctx, parseBackup(data.backup, ctx.botId), data.revision),
            });
        }

        throw new Error("未知接口");
    } catch (e) {
        return Response.json({ error: e instanceof Error ? e.message : "请求失败" }, { status: 400 });
    }
}
