import { validateTemplate, validateCopyText } from "../shared/templates.js";
import { commandUrl, expand } from "../shared/interpolation.js";
import { commandLinkPage } from "./pages/command-link.js";
import { registry } from "../modules/index.js";
import { samplePreview } from "../shared/ui/sample-preview.js";
import { messageEditor } from "../shared/ui/message-editor.js";
import { confirmation } from "../shared/ui/confirmation.js";
import { selectPicker } from "../shared/ui/select-picker.js";
import { copyEditor } from "../shared/ui/copy-editor.js";
import { scopes } from "./scopes.js";
import { components } from "./components.js";
import { markdownPreview } from "../shared/ui/markdown-preview.js";
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
    `const validateTemplate = ${validateTemplate.toString()}; const validateCopyText = ${validateCopyText.toString()};`,
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
    ...registry.pages.map((page) => page.source ?? ""),
    `
const bridge = await createBridge();
await createApp(bridge, createUI(), {
    ${registry.pages.map((page) => {
        const sections = page.sections?.map((section) => `${JSON.stringify(section.id)}: { label: ${JSON.stringify(section.title)}, page: ${section.factory}(app, ui) }`).join(",");
        const factory = page.factory ?? `(app, ui) => createSections(app, ui, ${JSON.stringify(page.title)}, {${sections}})`;
        return `${JSON.stringify(page.id)}: { title: ${JSON.stringify(page.title)}, create: ${factory}, module: true },`;
    }).join("\n")}
    settings: { title: "系统设置", create: createSettingsPage },
}).start();
`,
].join("\n");
