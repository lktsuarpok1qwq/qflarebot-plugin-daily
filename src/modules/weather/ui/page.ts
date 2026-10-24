export const weatherPage = String.raw`
function createWeatherCopyEditor(app, ui) {
    return createCopyEditor(app, ui, app.id, {
        renderSample(sample, config, key, mark) {
            const data = structuredClone(sample.data);

            if (key.startsWith('image_')) {
                const variables = { ...data.values, city: '示例城市', area: '示例地区', date: '10月3日' };

                return [{ text: mark(inlineCommandTools.expand(config.cardCopy[key.slice(6)], variables, data.fragments)) }];
            }

            return [{ text: renderWeatherSample(config.copy, key, data, inlineCommandTools.expand, (field, value) => field === key ? mark(value) : value) }];
        }
    });
}
`;
