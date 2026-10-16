import { createConfigStore } from "../../shared/config-store.js";
import type { PluginDB } from "@qqbot/sdk";
import type { CardRow } from "./cards/store.js";
import { defaults, parseConfig, validate } from "./config.js";
const store = createConfigStore({ table: "fortune_state", label: "运势", defaults, parse: parseConfig, validate });
export const { install, snapshot, save } = store;
export async function readCommandState(db: PluginDB, id: string) {
    const row = await db.first<{ config: string } & (CardRow | Record<keyof CardRow, null>)>(
        "SELECT s.config,c.id,c.day,c.token,c.snapshot,c.drawn FROM {fortune_state} s LEFT JOIN {fortune_cards} c ON c.id=? WHERE s.id=1", id,
    );

    if (!row) { throw new Error("运势尚未初始化"); }

    const { config, ...card } = row;
    return { config: parseConfig(config), card: card.id === null ? null : card };
}
export async function readPrompt(db: PluginDB, key: "help" | "noIdentity") {
    const row = await db.first<{ text: string }>("SELECT json_extract(config,?) AS text FROM {fortune_state} WHERE id=1 AND json_extract(config,'$.schemaVersion')=1", "$.copy." + key);

    if (!row || typeof row.text !== "string") { throw new Error("运势提示配置无效"); }

    return row.text;
}
