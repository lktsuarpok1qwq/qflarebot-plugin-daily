import { createConfigStore } from "../../shared/config-store.js";
import { defaults, validate, parseConfig } from "./config.js";

const store = createConfigStore({ table: "saying_state", label: "一言", defaults, parse: parseConfig, validate });
export const { install, snapshot, save } = store;
