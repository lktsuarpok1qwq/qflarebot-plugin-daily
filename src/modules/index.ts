import { fortune } from "./fortune/index.js";
import { saying } from "./saying/index.js";
import { weather } from "./weather/index.js";
import { calendar } from "./calendar/index.js";
import { notification } from "./notification/index.js";
import { createModules } from "../shared/modules.js";
export const modules = [notification, calendar, weather, saying, fortune];
export const registry = createModules(modules, { pages: ["settings"], commands: ["每日"] });
export const variables = registry.variables;
