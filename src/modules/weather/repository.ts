import type { PluginDB } from "@qqbot/sdk";
import { createConfigStore } from "../../shared/config-store.js";
import { defaults, validate, parseConfig } from "./config.js";
const store = createConfigStore({ table: "weather_state", label: "天气", defaults, parse: parseConfig, validate });
export const { install, snapshot, save } = store;
export async function readHelp(db: PluginDB) {
    const row = await db.first<{ help: string }>("SELECT json_extract(config,'$.copy.help') AS help FROM {weather_state} WHERE id=1 AND json_extract(config,'$.schemaVersion')=2");

    if (!row || typeof row.help !== "string") { throw new Error("天气帮助配置无效"); }

    return row.help;
}
