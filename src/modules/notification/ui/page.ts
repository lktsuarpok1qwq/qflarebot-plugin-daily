export const notificationPage = String.raw`
function createNotificationPage(app, ui) {
    const sections = createSections(app, ui, "通知", {
        tasks: { label: "任务", page: createTasksPage(app, ui) },
        recipients: { label: "对象", page: createRecipientsPage(app, ui) },
        templates: { label: "模板", page: createCopyTemplates(app, ui) },
        records: { label: "记录", page: createNotificationRecords(app, ui) },
    });
    const render = sections.render;
    sections.render = () => (app.config.paused ? '<p class="notice">通知已暂停，查询和维护照常运行</p>' : '') + render();
    return sections;
}
`;
