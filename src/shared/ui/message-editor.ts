export const messageEditor = String.raw`
function messageSamples(samples, body) {
    const keys = [...analyzeTemplate(body).keys];
    const differs = keys.some(key => samples.some(sample => (sample.values[key] || '') !== (samples[0].values[key] || '')));

    return differs ? samples : [{ ...samples[0], name: '无特殊情景' }];
}

function createMessageEditor(app, ui, settings) {
    const { $, esc } = ui, id = settings.id;
    let mode = 'sample', referenceHTML = '', activeFields = [];
    const positions = new Map(), bound = new WeakSet();
    let buttonsTarget;
    const buttons = createButtonEditor(id, () => settings.buttons?.(), () => {
        app.refresh();
    });
    const sample = createSamplePreview(app, ui, { ...settings, active: () => mode === 'sample', afterPaint: () => restoreImages() });
    const restoreImages = createPreviewImages(() => $(id + 'Workspace'));
    const context = field => settings.context?.() || field.id;

    function remember() {
        for (const field of activeFields) {
            const input = $(field.id);

            if (!input) { continue; }

            positions.set(field.positionKey, { start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection, top: input.scrollTop, height: input.style.height });
        }
    }

    function render(fields, options = {}) {
        activeFields = fields.map(field => ({ ...field, positionKey: context(field) }));
        const groups = fields.map(field => ({ label: field.label, variables: Object.keys(field.variables) }));
        const descriptions = Object.assign({}, ...fields.map(field => field.variables));
        referenceHTML = '<div id="' + esc(options.variablesId || id + 'Variables') + '">' + ui.variableReference(groups, descriptions, options.variableGroups, options.variableCompositions || app.state.variableCompositions, fields[0].id) + '</div>';
        const field = fields[0];

        return '<div id="' + id + 'Workspace" class="markdown-workspace"><div class="markdown-source-tools"><h3><label for="' + esc(field.id) + '">' + esc(settings.bodyLabel || '模板正文') + (field.single ? ' · ' + esc(field.label) : '') + '</label></h3>' +
            '<p id="' + esc(field.id) + '-uses" class="muted">' + (field.uses?.length ? '用于 ' + field.uses.map(name => '<strong>' + esc(name) + '</strong>').join('、') : esc(field.label)) + '</p>' + ui.toolbar(field.id) +
            '<p id="' + esc(field.id) + '-error" class="error" role="status" hidden></p></div>' +
            '<div class="markdown-editor"><textarea data-editor-context="' + esc(context(field)) + '" id="' + esc(field.id) + '" spellcheck="false" aria-describedby="' + esc(field.id) + '-hint ' + esc(field.id) + '-error ' + esc(field.id) + '-uses">' + esc(field.value) + '</textarea></div>' +
            '<div class="markdown-preview-tools"><h3 id="' + id + 'PreviewTitle">即时预览 · 完整消息</h3><div class="actions" role="group" aria-label="预览模式">' +
            '<button data-action="copy-preview-sample" aria-pressed="' + (mode === 'sample') + '">情景预览</button><button data-action="copy-preview-layout" aria-pressed="' + (mode === 'layout') + '">排版预览</button></div>' +
            '<div id="' + id + 'SampleTools"' + (mode === 'sample' ? '' : ' hidden') + '>' + sample.tools() + '</div>' +
            '<p id="' + id + 'LayoutTools" class="muted"' + (mode === 'layout' ? '' : ' hidden') + '>变量保持原样 · <span id="markdownPreviewLabel">当前正文</span></p></div>' +
            '<div class="local-preview"><div id="' + id + 'LayoutPanel" class="copy-layout"' + (mode === 'layout' ? '' : ' hidden') + '><div id="markdownPreview" class="message-preview"></div></div>' +
            '<div id="' + id + 'SamplePanel" class="copy-layout"' + (mode === 'sample' ? '' : ' hidden') + '>' + sample.render() + '</div><div id="' + id + 'PreviewButtons" class="message-buttons-preview"></div></div></div>' +
            '<p id="' + esc(field.id) + '-hint" class="muted">使用 QQ Markdown · ' + sample.hint() + ' · 实际显示以 QQ 为准</p>' + sample.notice();
    }

    function buttonSection() {
        return '<section id="' + id + 'MessageButtons" class="message-buttons"' + (settings.buttons?.() ? '' : ' hidden') + '><h3>消息按钮</h3><p class="muted">最多 5 行，每行 5 个按钮，文字最多 10 字；按固定文字显示，不替换变量</p><div id="' + id + 'ButtonsEditor"></div></section>';
    }

    function validateButtons(focus = false) {
        const state = settings.buttons?.();
        const error = state ? messageButtonError(state.rows) : null;
        const node = buttons.validate(error);

        if (focus && node) { app.focus(node.id); }

        return !error;
    }

    function paintButtons() {
        const target = $(id + 'PreviewButtons');

        if (!target) { return; }

        const rows = mode === 'layout' && activeFields[0]?.fragment ? [] : settings.previewButtons?.() || settings.buttons?.()?.rows || [];
        target.replaceChildren();

        for (const row of rows) {
            const line = document.createElement('div');
            line.className = 'actions';

            for (const item of row) {
                const node = document.createElement('button');
                node.textContent = item.label;
                node.disabled = true;
                node.setAttribute('data-locked', '');
                line.append(node);
            }

            target.append(line);
        }
    }

    function validate(focus = false) {
        let valid = true;

        for (const field of activeFields) {
            const input = $(field.id), error = $(field.id + '-error');

            if (!input || !error) { continue; }

            let message = '';

            try { validateCopyText(input.value, { ...field, variables: Object.keys(field.variables) }); } catch (e) {
                message = e.message;

                if (Number.isInteger(e.start)) {
                    const before = input.value.slice(0, e.start);
                    message += '（第 ' + before.split('\n').length + ' 行，第 ' + (e.start - before.lastIndexOf('\n')) + ' 列）';
                }

                if (focus && valid) { app.focus(field.id, e.start ?? 0, e.end ?? input.value.length); }
            }

            error.textContent = message;
            error.hidden = !message;
            input.setAttribute('aria-invalid', String(!!message));
            valid = valid && !message;
        }

        return validateButtons(focus && valid) && valid;
    }

    function refresh() {
        for (const field of activeFields) {
            const input = $(field.id);

            if (!input || bound.has(input)) { continue; }

            const position = positions.get(field.positionKey);

            if (position) {
                input.setSelectionRange(position.start, position.end, position.direction);
                input.scrollTop = position.top;
                input.style.height = position.height;
            }

            for (const name of ['select', 'scroll', 'keyup', 'focusout']) { input.addEventListener(name, remember); }

            bound.add(input);
        }

        const target = $(id + 'ButtonsEditor');

        if (target && buttonsTarget !== target) {
            buttonsTarget = target;
            buttons.draw();
        }

        validate();
        sample.refresh();
        paintButtons();
        const title = $(id + 'PreviewTitle');

        if (title) { title.textContent = '即时预览 · ' + (mode === 'layout' && activeFields[0]?.fragment ? '当前片段' : '完整消息'); }

        restoreImages();
    }

    async function action(a) {
        if (!['copy-preview-layout', 'copy-preview-sample'].includes(a)) { return false; }

        mode = a.slice('copy-preview-'.length);
        $(id + 'LayoutPanel').hidden = mode !== 'layout';
        $(id + 'SamplePanel').hidden = mode !== 'sample';
        $(id + 'SampleTools').hidden = mode !== 'sample';
        $(id + 'LayoutTools').hidden = mode !== 'layout';
        $(id + 'Workspace').querySelectorAll('[data-action^="copy-preview-"]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.action === a)));
        app.refresh();

        return true;
    }

    return {
        refreshButtons() {
            buttons.draw();
            refresh();
        },
        validate, validateButtons, buttonSection, render, action, remember, refresh, reference: () => referenceHTML,
        input(el) {
            if (!activeFields.some(field => field.id === el.id)) { return false; }

            validate();
            sample.input();

            return false;
        }, change: sample.change,
        transientInputs: sample.transientInputs,
    };
}
`;
