export const messageEditor = String.raw`
function messageSamples(samples, body) {
    const keys = [...body.matchAll(/\{\{([^{}]+)\}\}/g)].map((match) => match[1]);
    const differs = keys.some((key) => samples.some((sample) => (sample.values[key] || '') !== (samples[0].values[key] || '')));
    return differs ? samples : [{ ...samples[0], name: '无特殊情景' }];
}

function createMessageEditor(app, ui, settings) {
    const { $, esc } = ui, id = settings.id;
    let mode = 'sample', referenceHTML = '';
    const sample = createSamplePreview(app, ui, { ...settings, active: () => mode === 'sample' });
    function render(fields, options = {}) {
        const groups = fields.map((field) => ({ label: field.label, variables: Object.keys(field.variables) }));
        const descriptions = Object.assign({}, ...fields.map((field) => field.variables));
        referenceHTML = '<div id="' + esc(options.variablesId || id + 'Variables') + '">' + ui.variableReference(groups, descriptions, options.variableGroups, options.variableCompositions || app.state.variableCompositions) + '</div>';
        return '<div class="markdown-workspace"><div class="markdown-editor">' + fields.map((field) =>
            '<div id="' + esc(field.wrapperId || field.id + '-field') + '"><label for="' + esc(field.id) + '">' + esc(field.label) + '</label>' +
            (field.uses?.length ? '<small>用于 ' + field.uses.map((name) => '<strong>' + esc(name) + '</strong>').join('、') + '</small>' : '') +
            '<textarea id="' + esc(field.id) + '">' + esc(field.value) + '</textarea>' + ui.toolbar(field.id) + '</div>'
        ).join('') + '</div><div class="local-preview">' +
            '<div class="actions" role="group" aria-label="预览方式">' +
            '<button data-action="copy-preview-layout" aria-pressed="' + (mode === 'layout') + '">排版预览</button>' +
            '<button data-action="copy-preview-sample" aria-pressed="' + (mode === 'sample') + '">情景预览</button></div>' +
            '<div id="' + id + 'LayoutPanel" class="copy-layout"' + (mode === 'layout' ? '' : ' hidden') + '><h3>排版预览 · <span id="markdownPreviewLabel">当前文案</span></h3><p class="muted">变量保持原样</p><div id="markdownPreview" class="message-preview"></div></div>' +
            '<div id="' + id + 'SamplePanel"' + (mode === 'sample' ? '' : ' hidden') + '>' + sample.render() + '</div></div></div>';
    }
    async function action(a) {
        if (a !== 'copy-preview-layout' && a !== 'copy-preview-sample') { return false; }

        mode = a.slice('copy-preview-'.length);
        $(id + 'LayoutPanel').hidden = mode !== 'layout';
        $(id + 'SamplePanel').hidden = mode !== 'sample';
        sample.refresh();
        document.querySelectorAll('[data-action^="copy-preview-"]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.action === a)));
        return true;
    }
    return {
        render, action, reference: () => referenceHTML, refresh: sample.refresh,
        input() { sample.input(); return false; }, change: sample.change,
        selectBranch() { mode = 'sample'; sample.reset(); },
        transientInputs: sample.transientInputs,
    };
}
`;
