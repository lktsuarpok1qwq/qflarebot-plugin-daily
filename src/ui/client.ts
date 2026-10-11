import { modules } from "../modules/index.js";
import { scopes } from "./scopes.js";
import { components } from "./components.js";
import { markdownPreview } from "./markdown-preview.js";
import { application } from "./application.js";
import { tasksPage } from "./pages/tasks.js";
import { recipientsPage } from "./pages/recipients.js";
import { copyTemplates } from "./pages/copy-templates.js";
import { sections } from "../shared/ui/sections.js";
import { settingsPage } from "./pages/settings.js";
import { commandCopyPage } from "./command-copy.js";
import { statusPage } from "./pages/status.js";
// Keep browser code as source strings so the SDK can build this plugin without a separate frontend pipeline.
export const client = [
    String.raw`
import { createBridge } from "/bridge.js";
`,
    components,
    markdownPreview,
    tasksPage,
    recipientsPage,
    copyTemplates,
    sections,
    settingsPage,
    commandCopyPage,
    statusPage,
    application,
    scopes,
    ...modules.map((m) => m.ui.source),
    `
const bridge = await createBridge();
await createApp(bridge, createUI(), {
    tasks: { title: "通知任务", create: createTasksPage },
    recipients: { title: "发送对象", create: createRecipientsPage },
    templates: { title: "通知模板", create: createCopyTemplates },
    ${modules.map((m) => `${JSON.stringify(m.id)}: { title: ${JSON.stringify(m.ui.title)}, create: ${m.ui.factory}, module: true }`).join(",\n")},
    settings: { title: "系统设置", create: createSettingsPage },
}).start();
`,
].join("\n");
