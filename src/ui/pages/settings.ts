export const settingsPage = String.raw`
function createSettingsPage(app, ui) {
    return createSections(app, ui, "系统设置", {
        status: { label: "运行状态与备份", page: createStatusPage(app, ui) },
        feedback: {
            label: "通用提示",
            page: createCommandCopy(app, ui, '<p class="muted">用于所有命令，包括模块命令</p>', true),
        },
        commands: {
            label: "通用命令",
            page: createCommandCopy(app, ui, '<p class="muted">用于 <strong>/每日</strong></p>'),
        },
    });
}
`;
