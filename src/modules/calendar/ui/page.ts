export const calendarPage = String.raw`
function createCalendarPage(app, ui) {
    return createSections(app, ui, "日历", {
        entries: { label: "日历条目", page: createCalendarEntries(app, ui) },
        copy: { label: "文案", page: createCalendarCopyPage(app, ui) },
    });
}
`;
