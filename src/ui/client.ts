import { commandUrl, expand } from "../shared/interpolation.js";
import { commandLinkPage } from "./pages/command-link.js";
import { modules } from "../modules/index.js";
import { samplePreview } from "../shared/ui/sample-preview.js";
import { messageEditor } from "../shared/ui/message-editor.js";
import { confirmation } from "../shared/ui/confirmation.js";
import { selectPicker } from "../shared/ui/select-picker.js";
import { copyEditor } from "../shared/ui/copy-editor.js";
import { scopes } from "./scopes.js";
import { components } from "./components.js";
import { markdownPreview } from "./markdown-preview.js";
import { application } from "./application.js";
import { sections } from "../shared/ui/sections.js";
import { settingsPage } from "./pages/settings.js";
import { settingsEditor } from "../shared/ui/settings-editor.js";
// Keep browser code as source strings so the SDK can build this plugin without a separate frontend pipeline.
export const client = [
    String.raw`
import { createBridge } from "/bridge.js";
`,
    `const inlineCommandTools = { url: ${commandUrl.toString()}, expand: ${expand.toString()} };`,
    commandLinkPage,
    components,
    markdownPreview,
    sections,
    samplePreview,
    messageEditor,
    copyEditor,
    selectPicker,
    confirmation,
    settingsPage,
    settingsEditor,
    application,
    scopes,
    ...modules.map((m) => m.ui.source),
    `
const bridge = await createBridge();
await createApp(bridge, createUI(), {
    ${modules.map((m) => `${JSON.stringify(m.id)}: { title: ${JSON.stringify(m.ui.title)}, create: ${m.ui.factory}, module: true }`).join(",\n")},
    settings: { title: "系统设置", create: createSettingsPage },
}).start();
`,
].join("\n");
