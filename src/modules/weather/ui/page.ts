export const weatherPage = String.raw`
function createWeatherPage(app, ui) {
    return createSections(app, ui, "天气", {
        settings: { label: "接入设置", page: createWeatherSettings(app, ui) },
        copy: { label: "文案", page: createWeatherCopyPage(app, ui) },
    });
}
`;
