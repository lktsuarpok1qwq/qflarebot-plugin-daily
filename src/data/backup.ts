import type { Config } from "../types.js";
import type { Ctx } from "../shared/types.js";
import { snapshot, saveConfig } from "./repository.js";
import { LIMITS, SCHEMA_VERSION } from "../types.js";
import { validateConfig } from "./validation.js";
import { fields } from "../shared/validation.js";
import { modules } from "../modules/index.js";
export type Backup = {
    schemaVersion: typeof SCHEMA_VERSION;
    exportedAt: string;
    botId: string;
    config: Config;
    modules: Record<string, unknown>;
};
async function readModules(ctx: Ctx) {
    const rows = await ctx.db.batch(modules.flatMap((m) => m.backup.read));
    let offset = 0;
    return Object.fromEntries(
        modules.map((m) => {
            const value = m.backup.decode(rows.slice(offset, offset + m.backup.read.length));
            offset += m.backup.read.length;
            return [m.id, value];
        }),
    );
}
export async function moduleRevisions(ctx: Ctx) {
    return Object.fromEntries(Object.entries(await readModules(ctx)).map(([id, value]) => [id, value.revision]));
}
export async function exportBackup(ctx: Ctx): Promise<Backup> {
    const rows = await ctx.db.batch([
        { sql: "SELECT bot_id,config FROM {state} WHERE id=1" },
        ...modules.flatMap((m) => m.backup.read),
    ]);
    const state = rows[0]!.results[0] as { bot_id: string; config: string };
    let offset = 1;
    const data = Object.fromEntries(
        modules.map((m) => {
            const value = m.backup.decode(rows.slice(offset, offset + m.backup.read.length));
            offset += m.backup.read.length;
            return [m.id, value.data];
        }),
    );
    return verifyBackup(
        parseBackup(
            {
                schemaVersion: SCHEMA_VERSION,
                exportedAt: new Date().toISOString(),
                botId: state.bot_id,
                config: JSON.parse(state.config),
                modules: data,
            },
            ctx.botId,
        ),
    );
}
export function parseBackup(value: unknown, currentBot: string): Backup {
    const b = value as Backup;

    if (
        !b ||
        b.schemaVersion !== SCHEMA_VERSION ||
        typeof b.botId !== "string" ||
        !b.modules ||
        typeof b.modules !== "object" ||
        Array.isArray(b.modules) ||
        typeof b.exportedAt !== "string" ||
        !Number.isFinite(Date.parse(b.exportedAt)) ||
        new TextEncoder().encode(JSON.stringify(b)).length > LIMITS.backupBytes
    ) {
        throw new Error("备份格式或规模错误");
    }

    validateConfig(b.config);

    if (b.botId !== currentBot && b.config.recipients.some((r) => r.enabled)) {
        throw new Error("其他机器人备份不能启用旧目标；请先禁用目标，恢复后重新绑定");
    }

    for (const r of b.config.recipients) {
        if (r.enabled && r.botId !== currentBot) {
            throw new Error("发送目标尚未绑定当前机器人");
        }
    }

    return b;
}

export async function verifyBackup(b: Backup): Promise<Backup> {
    fields(b, ["schemaVersion", "exportedAt", "botId", "config", "modules"]);
    fields(
        b.modules,
        modules.map((m) => m.id),
    );

    for (const module of modules) {
        await module.backup.validate(b.modules[module.id]);
    }

    return b;
}
export async function restoreBackup(ctx: Ctx, b: Backup, expectedRevision: number, expectedModules: unknown) {
    const s = await snapshot(ctx.db);
    await verifyBackup(parseBackup(b, ctx.botId));

    if (!expectedModules || typeof expectedModules !== "object" || Array.isArray(expectedModules)) {
        throw new Error("请重新预览模块备份");
    }

    const revisions = expectedModules as Record<string, number>;

    for (const module of modules) {
        if (!Number.isSafeInteger(revisions[module.id]) || revisions[module.id]! < 1) {
            throw new Error("模块版本错误，请重新预览备份");
        }
    }

    for (const recipient of b.config.recipients) {
        const old = s.config.recipients.find((r) => r.id === recipient.id);

        if (
            old &&
            (old.scene !== recipient.scene || old.openid !== recipient.openid || old.botId !== recipient.botId)
        ) {
            throw new Error("备份复用了不同身份的目标 ID，请先重新绑定");
        }
    }

    if (s.revision !== expectedRevision) {
        throw new Error("配置已变化，请重新预览备份");
    }

    const inflight = await ctx.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM {deliveries} WHERE status='sending'");

    if (inflight?.n) {
        throw new Error("存在发送中或待判定的请求，等待调度器收敛后重试恢复");
    }

    const now = Date.now();
    return saveConfig(
        ctx,
        s,
        structuredClone(b.config),
        now,
        true,
        modules.map((m) => m.backup.restore(b.modules[m.id], revisions[m.id]!, now)),
    );
}
