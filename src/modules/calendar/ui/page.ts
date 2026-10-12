export const calendarPage = String.raw`
function createCalendarCopyEditor(app, ui) {
    return createCopyEditor(app, ui, app.id, {
        renderSample(sample, config, key, mark, view) {
            const target = view.id;
            const document = structuredClone(target === 'help' ? { day: sample.query.day, kind: 'help', items: [] } :
                ['today', 'eventToday'].includes(target) ? sample.reminder : ['next', 'variable-next'].includes(target) ? sample.next : sample.query);

            if (target === 'eventToday') { document.items = document.items.filter((item) => item.kind === 'event' || item.kind === 'reference'); }

            if (target.startsWith('variable-')) { delete document.empty; }

            const text = renderCalendarSample(document, config.calendarCopy, inlineCommandTools.expand, (field, value) => field === key ? mark(value) : value);
            return [{ text }];
        }

    });
}
`;
