import { saying } from "./saying/index.js";
import { weather } from "./weather/index.js";
import { calendar } from "./calendar/index.js";
import { createNotification } from "./notification/index.js";
import { createVariables } from "../shared/variables.js";
import type { ModuleAPI } from "./contract.js";
const providers = [calendar, weather, saying];
export const variables = createVariables(providers);
export const modules: readonly ModuleAPI[] = [createNotification(variables), ...providers];
