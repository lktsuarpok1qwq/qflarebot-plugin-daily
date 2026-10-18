import { snapshot, saveConfig } from "./data/repository.js";
import { copyEditor, outputs, settings } from "./content/definition.js";
import { configAdmin } from "./shared/admin.js";
import { commandLinks } from "./commands.js";
export const api = configAdmin({
    label: "系统", snapshot, save: saveConfig,
    present: (state) => state,
    declaration: () => ({
        settings,
        copyEditor: { ...copyEditor, samples: outputs.map((target) => ({ id: target.id, name: target.command ? "无特殊情景" : target.name, values: { today: "2026-10-03", year: "2026" }, fragments: { commands: commandLinks } })) },
    }),
});
