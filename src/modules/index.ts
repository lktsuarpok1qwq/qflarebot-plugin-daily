import { saying } from "./saying/index.js";
import { weather } from "./weather/index.js";
import { calendar } from "./calendar/index.js";
import { notification } from "./notification/index.js";
import { createModules } from "../shared/modules.js";
export const modules = [notification, calendar, weather, saying];
export const registry = createModules(modules, { pages: ["settings"], commands: ["每日"] });
export const variables = registry.variables;
