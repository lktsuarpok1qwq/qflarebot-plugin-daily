export const settingsPage = String.raw`
function createSettingsPage(app, ui) {
    return createSections(app, ui, "系统设置", {
        copy: { label: "文案", create: () => createCopyEditor(app, ui, "reply") },
        images: { label: "图片设置", create: () => createSettingsEditor(app, ui) },
        links: { label: "命令链接", create: () => createCommandLinkPage(app, ui) },
    });
}
`;
