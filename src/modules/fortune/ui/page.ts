export const fortunePage = String.raw`
function createFortuneSettings(app, ui) {
    const editor = createSettingsEditor(app, ui), render = editor.render;
    editor.render = () => '<p role="status" class="muted">' + ui.esc(app.state.corpusStatus) + '</p>' + render();
    return editor;
}
function createFortuneCopyEditor(app, ui) {
    return createCopyEditor(app, ui, app.id, {
        renderSample(sample, config, key, mark) {
            const text = sample.snapshot
                ? renderFortuneText(config.copy, sample.field === 'drawText' ? 'small' : 'detail', sample.snapshot, inlineCommandTools.expand)
                : config.copy[sample.field];
            return [{ text: sample.field === key ? mark(text) : text }];
        }
    });
}
`;
