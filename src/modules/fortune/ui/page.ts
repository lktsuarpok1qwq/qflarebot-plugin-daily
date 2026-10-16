export const fortunePage = String.raw`
function createFortuneSettings(app, ui) {
    const editor = createSettingsEditor(app, ui), render = editor.render, action = editor.action;
    editor.render = () => '<p role="status" class="muted">' + ui.esc(app.state.corpusStatus) + '</p>' + render() +
        '<section><h2>当天记录</h2><p>重置所有用户当天的运势，下次抽签重新生成图片；抽取设置不变时，同日签文不变</p>' +
        '<div class="actions">' + ui.btn('重置当天', 'reset-fortune-today', '', 'danger') + '</div></section>';
    editor.action = async (a) => {
        if (a !== 'reset-fortune-today') { return action(a); }

        const day = app.state.today;

        if (!(await app.confirmAction('重置 ' + day + ' 所有用户的运势记录？重置后须重新抽签，使用已保存的设置；已发送图片保留，正在处理的请求可能仍会完成'))) { return; }

        const result = await app.api('reset-today', { day });
        app.status('已重置 ' + result.day + ' 的运势记录，下次请先抽签');
    };
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
