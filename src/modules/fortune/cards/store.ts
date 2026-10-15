import type { PluginDB } from "@qqbot/sdk";
import type { FortuneCardContent, FortuneCardLabels } from "./types.js";
export type CardSnapshot = { content: FortuneCardContent; labels: FortuneCardLabels };
export type CardRow = { id: string; day: string; token: string; snapshot: string; drawn: number };
export async function installCards(db: PluginDB) {
    await db.exec("CREATE TABLE IF NOT EXISTS {fortune_cards}(id TEXT PRIMARY KEY,day TEXT NOT NULL,token TEXT NOT NULL,snapshot TEXT NOT NULL,drawn INTEGER NOT NULL DEFAULT 0) WITHOUT ROWID");
}
export async function userKey(botId: string, userId: string) {
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([botId, userId]))));
    return Array.from(hash, byte => byte.toString(16).padStart(2, "0")).join("");
}
export const readCard = (db: PluginDB, id: string) => db.first<CardRow>("SELECT id,day,token,snapshot,drawn FROM {fortune_cards} WHERE id=?", id);
export async function claimCard(db: PluginDB, id: string, day: string, card: CardSnapshot) {
    const token = crypto.randomUUID(), snapshot = JSON.stringify(card);
    const claimed = await db.first<{ claimed: number }>("INSERT INTO {fortune_cards}(id,day,token,snapshot) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET day=excluded.day,token=excluded.token,snapshot=excluded.snapshot,drawn=0 WHERE {fortune_cards}.day<excluded.day RETURNING 1 AS claimed", id, day, token, snapshot);
    const row = claimed ? { id, day, token, snapshot, drawn: 0 } : await readCard(db, id);

    if (!row || row.day !== day) { throw new Error("抽签日期已变化，请重新抽签"); }

    return { row, fresh: claimed ? card : undefined };
}
export async function markDrawn(db: PluginDB, row: CardRow) {
    if (row.drawn) { return; }

    await db.run("UPDATE {fortune_cards} SET drawn=1 WHERE id=? AND day=? AND token=? AND drawn=0", row.id, row.day, row.token);
}
