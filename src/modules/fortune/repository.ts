import { createConfigStore } from "../../shared/config-store.js";
import { defaults, parseConfig, validate } from "./config.js";
const store = createConfigStore({ table: "fortune_state", label: "运势", defaults, parse: parseConfig, validate });
export const { install, snapshot, save } = store;
