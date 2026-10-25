import { copyEditor } from "./definition.js";
import { configAdmin } from "../../shared/admin.js";
import { snapshot, save } from "./repository.js";

export const api = configAdmin({ label: "一言", snapshot, save, present: (state) => state, declaration: () => ({ copyEditor }) });
