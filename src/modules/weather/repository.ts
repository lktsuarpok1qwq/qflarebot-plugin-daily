import { createConfigStore } from "../../shared/config-store.js";
import { defaults, validate, parseConfig } from "./config.js";
const store = createConfigStore({ table: "weather_state", label: "天气", defaults, parse: parseConfig, validate });
export const { install, snapshot, save } = store;
