import { messageButtonError } from "../shared/message-buttons.js";
import { buttonEditor } from "../shared/ui/button-editor.js";
import { cardEditor } from "../shared/ui/cards/editor.js";
import { analyzeTemplate, validateTemplate, validateCopyText } from "../shared/templates.js";
import { commandUrl, expand, joinItems } from "../shared/interpolation.js";
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
import { renderQQMarkdown } from "../shared/ui/markdown.js";
import { previewImages } from "../shared/ui/preview-images.js";
import { textTools } from "../shared/ui/text-tools.js";
import { feedback } from "../shared/ui/feedback.js";
import { configState } from "../shared/ui/config-state.js";

const pages = registry.pages;
// 浏览器代码保存为源码字符串，由 SDK 构建插件，无需独立前端构建流程
export const client = [
    String.raw`
import { createBridge } from "/bridge.js";
`,
    `const inlineCommandTools = { url: ${commandUrl.toString()}, expand: ${expand.toString()}, join: ${joinItems.toString()} };`,
    `const analyzeTemplate = ${analyzeTemplate.toString()}; const validateTemplate = ${validateTemplate.toString()}; const validateCopyText = ${validateCopyText.toString()};`,
    commandLinkPage,
    `const renderQQMarkdown = ${renderQQMarkdown.toString()};`,
    previewImages,
    textTools,
    components,
    cardEditor,
    markdownPreview,
    sections,
    samplePreview,
    `const messageButtonError = ${messageButtonError.toString()};`,
    configState,
    buttonEditor,
    messageEditor,
    copyEditor,
    selectPicker,
    confirmation,
    settingsPage,
    settingsEditor,
    feedback,
    application,
    scopes,
    ...pages.map((page) => page.source ?? ""),
    `
const bridge = await createBridge();
bridge.setTitle("每日助手");
await createApp(bridge, createUI(), {
    ${pages.map((page) => {
        const sections = page.sections?.map((section) => `${JSON.stringify(section.id)}: { label: ${JSON.stringify(section.title)}, create: () => ${section.factory}(app, ui) }`).join(",");
        const factory = page.factory ?? `(app, ui) => createSections(app, ui, ${JSON.stringify(page.title)}, {${sections}})`;

        return `${JSON.stringify(page.id)}: { title: ${JSON.stringify(page.title)}, create: ${factory}, checkState: ${page.checkState ?? "undefined"}, module: true },`;
    }).join("\n")}
    settings: { title: "系统设置", create: createSettingsPage },
}).start();
`,
].join("\n");
