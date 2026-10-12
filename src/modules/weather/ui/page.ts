export const weatherPage = String.raw`
function createWeatherCopyEditor(app, ui) {
    return createCopyEditor(app, ui, app.id, {
        renderSample(sample, config, key, mark, view) {
            const data = structuredClone(sample.data);

            if (view.id === 'tomorrow') {
                if (data.values?.date) { data.values.date = new Date(Date.parse(data.values.date) + 86400000).toISOString().slice(0, 10); }

                if (data.candidates) {
                    data.candidates = data.candidates.map((candidate) => ({ ...candidate, command: candidate.command + ' 明天', command_link: '[' + inlineCommandTools.expand('{{command}}', { command: candidate.command + ' 明天' }) + '](' + inlineCommandTools.url(candidate.command + ' 明天') + ')', command_url: inlineCommandTools.url(candidate.command + ' 明天') }));
                }
            }

            return [{ text: renderWeatherSample(config.copy, key, data, inlineCommandTools.expand, (field, value) => field === key ? mark(value) : value) }];
        }
    });
}
`;
