import { AdminError, validateInput } from "../../shared/admin-errors.js";
import { adminHandler, stateResponse } from "../../shared/admin.js";
import { settings } from "./definition.js";
import type { VariableAPI } from "../../shared/variables.js";
import type { PluginDB, RouteInput } from "@qqbot/sdk";
import { LIMITS, SCHEMA_VERSION, type Config, type Snapshot } from "./types.js";
import { COPY } from "./copy.js";
import { snapshot, saveConfig, bindingId } from "./data/repository.js";
import { validateConfig } from "./data/validation.js";
import { maintenance } from "./data/maintenance.js";
import { message } from "../../shared/message.js";
import { renderMessage } from "./content/renderer.js";
import { finishMany } from "./data/deliveries.js";
import { resultStatus } from "./scheduler/result.js";
import { at, dateAt, addDays, DAY } from "../../shared/date.js";
import { body } from "../../shared/request.js";

async function testResult(db: PluginDB, key: string, taskId: string, recipientId: string): Promise<Response | null> {
    const prior = await db.first<{
        task_id: string;
        recipient_id: string;
        status: string;
        error: string | null;
        message_id: string | null;
        details: string | null;
    }>("SELECT task_id,recipient_id,status,error,message_id,details FROM {deliveries} WHERE key=?", key);

    if (!prior) { return null; }

    if (prior.task_id !== taskId || prior.recipient_id !== recipientId) {
        throw new AdminError("validation", "重复测试请求");
    }

    return Response.json({
        ok: prior.status === "success", status: prior.status, error: prior.error,
        messageId: prior.message_id, duplicate: true,
        text: prior.details ? (JSON.parse(prior.details) as { text?: string }).text : undefined,
    });
}

function present(state: Snapshot, botId: string) {
    const needsCursors = state.config.bindings.length && state.config.tasks.some((t) => t.enabled && t.schedule.kind === "once" && at(t.schedule.date, t.schedule.time) <= Date.now());

    return { ...state, currentBotId: botId, cursors: needsCursors ? null : [] };
}

// 所有调用均经过宿主的 auth: "admin" 路由
export const api = adminHandler({ GET: ["state", "cursors", "jobs", "logs", "log"], POST: ["config", "maintenance", "test"] }, async ({ ctx, request, params }: RouteInput, variables: VariableAPI): Promise<Response> => {
    const action = params.action ?? "",
        url = new URL(request.url);

    if (request.method === "GET") {
        if (action === "jobs") {
            return Response.json(await ctx.db.all("SELECT * FROM {maintenance} WHERE job='cleanup'"));
        }

        if (action === "log") {
            const key = url.searchParams.get("key");

            if (!key || !/^[\w:-]{1,200}$/.test(key)) { throw new AdminError("validation", "记录参数错误"); }

            const record = await ctx.db.first("SELECT * FROM {deliveries} WHERE key=?", key);

            return Response.json({ record });
        }

        if (action === "cursors") {
            const row = await ctx.db.first<{ schema_version: number; bindings: string }>(
                "SELECT json_extract(config,'$.schemaVersion') AS schema_version,json_extract(config,'$.bindings') AS bindings FROM {notification_state} WHERE id=1",
            );

            if (!row) { throw new Error("通知尚未初始化"); }

            if (row.schema_version !== SCHEMA_VERSION) { throw new Error("配置格式不受支持"); }

            const bindings = JSON.parse(row.bindings) as Config["bindings"];
            const ids = bindings.map((b) => bindingId(b.taskId, b.recipientId));

            return Response.json(ids.length ? await ctx.db.all(
                `SELECT task_id,due_at FROM {bindings} WHERE id IN (${ids.map(() => "?").join(",")})`, ...ids,
            ) : []);
        }

        if (action === "state") {
            const s = await snapshot(ctx.db);

            return stateResponse(request, { ...present(s, ctx.botId), jobs: null }, () => ({
                draftDefaults: COPY.drafts,
                settings,
                variables: variables.keys,
                variableDescriptions: variables.descriptions,
                variableGroups: variables.groups,
                variableCompositions: variables.compositions,
                copySamples: [
                    { id: "example", name: "模块示例内容", values: variables.sampleValues() },
                    { id: "empty", name: "模块无内容", values: { 日期: "2026-10-03", 星期: "星期六" } },
                ],
                limits: LIMITS,
            }));
        }

        if (action === "logs") {
            const filter: string[] = [], args: unknown[] = [];
            const days = url.searchParams.get("days") ?? "7", now = Date.now();

            if (!["0", "1", "7", "30", "90"].includes(days)) { throw new AdminError("validation", "查询时间范围无效"); }

            const hasFrom = url.searchParams.has("from"), hasTo = url.searchParams.has("to");
            const range = {
                from: hasFrom ? Number(url.searchParams.get("from")) : days === "0" ? 0 : at(addDays(dateAt(now), 1 - Number(days)), "00:00"),
                to: hasTo ? Number(url.searchParams.get("to")) : days === "0" ? Number.MAX_SAFE_INTEGER : now + 1,
            };

            if (hasFrom !== hasTo || !Number.isSafeInteger(range.from) || !Number.isSafeInteger(range.to) || range.from < 0 || range.to <= range.from
                || days !== "0" && range.to - range.from > Number(days) * DAY) { throw new AdminError("validation", "查询时间范围无效"); }

            if (range.from !== 0 || range.to !== Number.MAX_SAFE_INTEGER) {
                filter.push("claimed_at>=? AND claimed_at<?");
                args.push(range.from, range.to);
            }

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

            const before = url.searchParams.get("before");

            if (before) {
                if (before.length > 256) { throw new AdminError("validation", "分页参数错误"); }

                const cursor: unknown = validateInput(() => JSON.parse(before));

                if (!Array.isArray(cursor) || cursor.length !== 2 || !Number.isSafeInteger(cursor[0]) || cursor[0] < 0 || typeof cursor[1] !== "string" || !/^[\w:-]{1,200}$/.test(cursor[1])) {
                    throw new AdminError("validation", "分页参数错误");
                }

                filter.push("(claimed_at,key)<(?,?)");
                args.push(...cursor);
            }

            const rows = await ctx.db.all<{ key: string; claimed_at: number }>(
                `SELECT key,task_id,recipient_id,due_at,status,claimed_at,updated_at FROM {deliveries}${filter.length ? " WHERE " + filter.join(" AND ") : ""} ORDER BY claimed_at DESC,key DESC LIMIT 51`,
                ...args,
            );
            const items = rows.slice(0, 50), last = items.at(-1);

            return Response.json({ items, next: rows.length > 50 && last ? JSON.stringify([last.claimed_at, last.key]) : null, range });
        }

        throw new AdminError("validation", "未知接口");
    }

    const data = await body(
        request,
        LIMITS.bodyBytes + 4096,
    );

    if (action === "maintenance") {
        if (data.job !== "cleanup") {
            throw new AdminError("validation", "维护类型错误");
        }

        return Response.json(await maintenance(ctx, Date.now(), true));
    }

    const s = await snapshot(ctx.db);

    if (action === "config") {
        if (data.revision !== s.revision) {
            throw new AdminError("conflict", "配置已变化，请刷新");
        }

        const c = validateInput(() => {
            const c = validateConfig(data.config, variables.keys);

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

            return c;
        });

        return Response.json(present({
            config: c, botId: ctx.botId,
            revision:
                s.botId === ctx.botId && JSON.stringify(c) === JSON.stringify(s.config)
                    ? s.revision
                    : await saveConfig(ctx, s, c, Date.now()),
        }, ctx.botId));
    }

    if (action === "test") {
        const c = s.config,
            t = c.tasks.find((t) => t.id === data.taskId),
            b = c.bindings.find((b) => b.taskId === data.taskId && b.recipientId === data.recipientId);

        if (!t || !b) {
            throw new AdminError("validation", "请选择任务及其绑定目标");
        }

        const r = c.recipients.find((r) => r.id === b.recipientId)!;

        if (r.botId !== ctx.botId) {
            throw new AdminError("validation", "不能向其他机器人的目标发送");
        }

        // 一次性请求标识防止双击导致重复发送
        if (typeof data.requestId !== "string" || !/^[\w-]{16,80}$/.test(data.requestId)) {
            throw new AdminError("validation", "测试请求标识错误");
        }

        const key = `test:${data.requestId}`;
        const prior = await testResult(ctx.db, key, t.id, r.id);

        if (prior) { return prior; }

        if (data.config || s.config.paused || s.botId !== ctx.botId) {
            throw new AdminError("validation", "测试需要已保存的配置且未暂停");
        }

        const rendered = await renderMessage(
            t,
            c,
            Date.now(),
            variables.resolve(ctx),
            variables.keys,
        );

        if (!rendered.text) {
            throw new AdminError("validation", "测试内容为空");
        }

        const now = Date.now();
        const claimed = await ctx.db.run(
            "INSERT OR IGNORE INTO {deliveries}(key,task_id,recipient_id,due_at,revision,status,claimed_at,updated_at,details) SELECT ?,?,?,?,revision,'sending',?,?,? FROM {notification_state} WHERE revision=?",
            key,
            t.id,
            r.id,
            now,
            now,
            now,
            JSON.stringify({ manual: true, text: rendered.text }),
            s.revision,
        );

        if (!claimed.changes) {
            const prior = await testResult(ctx.db, key, t.id, r.id);

            if (prior) { return prior; }

            throw new AdminError("conflict", "配置已变化，请刷新后重试");
        }

        const fresh = await ctx.db.first<{ revision: number }>("SELECT revision FROM {notification_state} WHERE id=1");

        if (fresh?.revision !== s.revision) {
            await ctx.db.run("UPDATE {deliveries} SET status='skipped_disabled' WHERE key=?", key);
            throw new AdminError("conflict", "配置已变化，取消测试");
        }

        try {
            const result = await ctx.api.sendMessage({ scene: r.scene, id: r.openid }, message(rendered.text, rendered.buttons));
            const outcome = resultStatus(result);
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
                    ...outcome,
                    now: Date.now(),
                    next: null,
                },
            ]);

            return Response.json({
                ok: result.ok,
                status: outcome.status,
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

    throw new AdminError("validation", "未知接口");
});
