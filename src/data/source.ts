import type { Ctx, SourceKind } from "../types.js";
export type SyncResult = {
  kind: SourceKind;
  year: number;
  status: "updated" | "cached" | "not_published" | "error";
  error?: string;
};
export async function hash(text: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
export async function limitedJson(res: Response, maxBytes = 128_000) {
  if (!res.body) throw new Error("假期源为空");
  const reader = res.body.getReader();
  let size = 0,
    text = "";
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("假期源过大");
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally {
    await reader.cancel();
  }
}
export async function setError(
  ctx: Ctx,
  year: number,
  error: string,
  now: number,
  kind: "official" | "festival" = "official",
) {
  await ctx.db.run(
    "INSERT INTO {sources}(year,hash,data,error,updated_at,kind) VALUES (?,'','',?,?,?) ON CONFLICT(kind,year) DO UPDATE SET error=excluded.error WHERE error IS NOT excluded.error",
    year,
    error,
    now,
    kind,
  );
}
