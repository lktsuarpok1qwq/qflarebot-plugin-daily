import type { PluginDB } from "@qqbot/sdk";
import type { Config } from "../types.js";
import { copyContract } from "../content/definition.js";
import { validateConfig } from "./validation.js";
import { createConfigStore } from "../shared/config-store.js";
export const defaults = (): Config => copyContract.defaults({ schemaVersion: 1, imagePublicUrl: "" });
const store = createConfigStore({ table: "state", label: "系统", defaults, parse: (raw) => validateConfig(JSON.parse(raw)), validate: validateConfig });
export const { install, snapshot, save: saveConfig } = store;
export async function readConfig(db: PluginDB) { return (await snapshot(db)).config; }
