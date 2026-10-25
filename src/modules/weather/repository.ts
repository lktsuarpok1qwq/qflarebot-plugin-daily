import type { MessageButtons } from "../../shared/message-buttons.js";
import type { PluginDB } from "@qqbot/sdk";
import { createConfigStore } from "../../shared/config-store.js";
import { defaults, validate, parseConfig } from "./config.js";

const store = createConfigStore({ table: "weather_state", label: "天气", defaults, parse: parseConfig, validate });
export const { install, snapshot, save } = store;

export async function readHelp(db: PluginDB) {
    const row = await db.first<{ help: string; buttons: string | null }>("SELECT json_extract(config,'$.copy.help') AS help,json_extract(config,'$.buttons.help') AS buttons FROM {weather_state} WHERE id=1 AND json_extract(config,'$.schemaVersion')=2");

    if (!row || typeof row.help !== "string") { throw new Error("天气帮助配置无效"); }

    return { text: row.help, buttons: row.buttons === null ? undefined : JSON.parse(row.buttons) as MessageButtons };
}
