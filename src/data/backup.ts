import type { Config, Ctx, Source } from "../types.js";
import { snapshot, saveConfig } from "./repository.js";
import { LIMITS } from "../types.js";
import { validateConfig } from "./validation.js";
import { validateYear, hash } from "./holiday-cn.js";
export type Backup = {
  schemaVersion: 1;
  exportedAt: string;
  botId: string;
  config: Config;
  sources: Source[];
  progress: { binding_id: string; event_key: string }[];
};
export async function exportBackup(ctx: Ctx): Promise<Backup> {
  const rows = await ctx.db.batch([
    { sql: "SELECT bot_id,config FROM {state} WHERE id=1" },
    { sql: "SELECT * FROM {sources}" },
    { sql: "SELECT binding_id,event_key FROM {event_progress}" },
  ]);
  const s = rows[0]!.results[0] as { bot_id: string; config: string };
  const backup: Backup = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    botId: s.bot_id,
    config: JSON.parse(s.config) as Config,
    sources: rows[1]!.results as Source[],
    progress: rows[2]!.results as Backup["progress"],
  };
  // Never offer a download which our own importer rejects.
  return verifyBackup(parseBackup(backup, s.bot_id));
}
export function parseBackup(value: unknown, currentBot: string): Backup {
  const b = value as Backup;
  if (
    !b ||
    b.schemaVersion !== 1 ||
    typeof b.botId !== "string" ||
    !Array.isArray(b.sources) ||
    !Array.isArray(b.progress) ||
    typeof b.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(b.exportedAt)) ||
    new TextEncoder().encode(JSON.stringify(b)).length > LIMITS.backupBytes
  )
    throw new Error("备份格式或规模错误");
  validateConfig(b.config);
  if (b.botId !== currentBot && b.config.recipients.some((r) => r.enabled))
    throw new Error(
      "其他机器人备份不能启用旧目标；请先禁用目标，恢复后重新绑定",
    );
  for (const r of b.config.recipients)
    if (r.enabled && r.botId !== currentBot)
      throw new Error("发送目标尚未绑定当前机器人");
  const years = new Set<number>();
  for (const s of b.sources) {
    if (
      !s ||
      !Number.isInteger(s.year) ||
      s.year < 2000 ||
      s.year > 2199 ||
      years.has(s.year) ||
      typeof s.data !== "string" ||
      new TextEncoder().encode(s.data).length > 128000 ||
      typeof s.hash !== "string" ||
      (s.data ? !/^[a-f0-9]{64}$/.test(s.hash) : s.hash !== "") ||
      (s.error !== null && typeof s.error !== "string") ||
      !Number.isFinite(s.updated_at)
    )
      throw new Error("假期源备份非法");
    years.add(s.year);
    if (s.data) validateYear(JSON.parse(s.data), s.year);
  }
  for (const p of b.progress)
    if (
      !p ||
      typeof p.binding_id !== "string" ||
      typeof p.event_key !== "string" ||
      !/^[\w-]{1,80}:[\w-]{1,80}$/.test(p.binding_id) ||
      !/^[\w-]{1,80}:\d{1,3}$/.test(p.event_key) ||
      Number(p.event_key.split(":")[1]) > 366
    )
      throw new Error("防重进度格式错误");
  return b;
}
export async function verifyBackup(b: Backup): Promise<Backup> {
  for (const source of b.sources)
    if (source.data && (await hash(source.data)) !== source.hash)
      throw new Error("备份假期源指纹不匹配");
  return b;
}
export async function restoreBackup(
  ctx: Ctx,
  b: Backup,
  expectedRevision: number,
) {
  const s = await snapshot(ctx.db);
  await verifyBackup(parseBackup(b, ctx.botId));
  for (const recipient of b.config.recipients) {
    const old = s.config.recipients.find((r) => r.id === recipient.id);
    if (
      old &&
      (old.scene !== recipient.scene ||
        old.openid !== recipient.openid ||
        old.botId !== recipient.botId)
    )
      throw new Error("备份复用了不同身份的目标 ID，请先重新绑定");
  }
  if (s.revision !== expectedRevision)
    throw new Error("配置已变化，请重新预览备份");
  const inflight = await ctx.db.first<{ n: number }>(
    "SELECT COUNT(*) AS n FROM {deliveries} WHERE status='sending'",
  );
  if (inflight?.n)
    throw new Error("存在发送中或待判定的请求，等待调度器收敛后重试恢复");
  return saveConfig(ctx, s, b.config, Date.now(), true, {
    sources: b.sources,
    progress: b.progress,
  });
}
