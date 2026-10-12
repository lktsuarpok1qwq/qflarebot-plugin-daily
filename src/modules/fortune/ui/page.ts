export const fortunePage = String.raw`
function createFortuneSettings(app, ui) {
    const editor = createSettingsEditor(app, ui), render = editor.render;
    editor.render = () => '<p role="status" class="muted">' + ui.esc(app.state.corpusStatus) + '</p>' + render();
    return editor;
}
function createFortuneCopyEditor(app, ui) {
    return createCopyEditor(app, ui, app.id, {
        renderSample(sample, config, key, mark) {
            return [{ text: renderFortuneSample(config.copy, sample.document, inlineCommandTools.expand, (field, value) => field === key ? mark(value) : value) }];
        }
    });
}
`;
