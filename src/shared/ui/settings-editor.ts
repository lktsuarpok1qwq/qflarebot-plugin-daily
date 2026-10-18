export const settingsEditor = String.raw`
function createSettingsEditor(app, ui, declaration = () => app.state.settings) {
    const { $, esc, btn } = ui;
    let drafts = {};
    const settings = () => declaration();
    function renderFields(fields) {
        return '<div class="grid">' + fields.map((field) => {
            const value = field.secret ? drafts[field.key] || '' : drafts[field.key] ?? app.config[field.key];
            let input;

            if (field.type === 'checkbox') {
                input = ui.check(esc(field.label), field.id, value);
            } else if (field.type === 'select') {
                input = '<label>' + esc(field.label) + '<select id="' + esc(field.id) + '">' + ui.options(field.options, String(value)) + '</select></label>';
            } else {
                input = '<label>' + esc(field.label) + '<input id="' + esc(field.id) + '" type="' + field.type + '" value="' + esc(value) + '"' +
                    (field.type === 'number' && field.step !== undefined ? ' step="' + esc(field.step) + '"' : '') +
                    (field.type === 'password' ? ' autocomplete="new-password"' : '') +
                    (field.secret ? ' placeholder="' + esc(app.state[field.secret.saved] ? '已保存，留空保留' : '填写 ' + field.label) + '"' : '') + '></label>';
            }

            return '<div>' + input + (field.hint ? '<small>' + esc(field.hint) + '</small>' : '') + '</div>';
        }).join('') + '</div>';
    }
    function render() {
        const d = settings(), groups = new Map();

        for (const field of d.fields) {
            const title = field.group || (field.type === 'checkbox' ? '开关选项' : '参数设置');

            if (!groups.has(title)) { groups.set(title, []); }

            groups.get(title).push(field);
        }

        const content = groups.size > 1
            ? Array.from(groups, ([title, fields]) => '<fieldset><legend>' + esc(title) + '</legend>' + renderFields(fields) + '</fieldset>').join('')
            : renderFields(d.fields);
        return '<section><h2>' + esc(d.title) + '</h2>' + (d.description ? '<p>' + esc(d.description) + '</p>' : '') +
            (d.link ? '<p><a href="' + esc(d.link.url) + '" target="_blank" rel="noopener noreferrer">' + esc(d.link.label) + '</a></p>' : '') +
            content + '<div class="actions">' + btn('保存', 'save-' + d.id, '', 'primary') + btn('取消', 'cancel-' + d.id) +
            (d.test ? btn('测试连接', d.test.action) : '') + '</div>' +
            (d.test ? '<p id="' + d.test.resultId + '" role="status" class="muted">' + esc(d.test.hint) + '</p>' : '') + '</section>';
    }
    function candidate() {
        const config = structuredClone(app.config);

        for (const field of settings().fields) {
            if (field.secret) {
                config[field.key] = (drafts[field.key] || '').trim();
            } else if (Object.hasOwn(drafts, field.key)) {
                config[field.key] = typeof drafts[field.key] === 'string' ? drafts[field.key].trim() : drafts[field.key];
            }
        }

        return config;
    }
    function reset() { drafts = {}; }
    async function action(a) {
        const d = settings();

        if (d.test && a === d.test.action) {
            const result = $(d.test.resultId);
            result.textContent = '正在测试连接…';
            result.className = 'muted';

            try {
                result.textContent = (await app.api(d.test.endpoint, { config: candidate() })).message;
            } catch (error) {
                result.textContent = error.message;
                result.className = 'error';
            }
        } else if (a === 'cancel-' + d.id) {
            reset();
            app.render();
        } else if (a === 'save-' + d.id) {
            app.config = candidate();

            await app.save(undefined, reset);
        }
    }
    function input(el) {
        const d = settings(), field = d.fields.find((field) => field.id === el.id);

        if (!field) { return; }

        drafts[field.key] = field.type === 'checkbox' ? el.checked : field.type === 'number' || field.valueType === 'number' ? Number(el.value) : el.value;

        if (d.test && $(d.test.resultId)) {
            $(d.test.resultId).textContent = '内容已修改，请重新测试';
            $(d.test.resultId).className = 'muted';
        }
    }
    return { render, action, input, change: input, reset, get discardActions() { return ['cancel-' + settings().id]; } };
}
`;
