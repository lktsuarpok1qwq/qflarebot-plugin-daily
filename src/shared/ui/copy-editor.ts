export const copyEditor = String.raw`
function createCopyEditor(app, ui, id = app.id, extensions = {}) {
    const { esc, btn } = ui;
    const settings = () => app.state.copyEditor;
    const actionId = id + "-copy";
    let selected, selectedCategory, selectedBranch, drafts = {};
    const views = () => settings().views;
    const view = () => views().find((item) => item.id === (selected ?? settings().initial)) || views()[0];
    const categories = () => [...new Set(view().keys.map((key) => settings().fields[key].category))];
    const category = () => categories().includes(selectedCategory) ? selectedCategory : categories()[0];
    const branches = () => view().keys.filter((key) => settings().fields[key].category === category());
    const branch = () => branches().includes(selectedBranch) ? selectedBranch : branches()[0];
    const fieldId = (key) => settings().fields[key].inputId || id + "-copy-" + key;
    const read = (config, path) => path.reduce((value, key) => value[key], config);
    const preview = createMessageEditor(app, ui, {
        id, currentValue: () => value(branch()),
        samples: () => settings().samples.filter((sample) => settings().fields[branch()].samples.includes(sample.id) && (!view().samples || view().samples.includes(sample.id))).map((sample) => ({ ...sample, name: settings().fields[branch()].sampleNames?.[sample.id] || sample.name })),
        renderSample: (sample, mark) => extensions.renderSample ? extensions.renderSample(sample, previewConfig(), branch(), mark, view()) : [{ text: mark(inlineCommandTools.expand(value(branch()), sample.values || {}, sample.fragments || {})) }],
    });
    function previewConfig() {
        const config = {};

        for (const [key, field] of Object.entries(settings().fields)) {
            let target = config;

            for (const part of field.path.slice(0, -1)) { target = target[part] ??= {}; }

            target[field.path.at(-1)] = value(key);
        }

        return config;
    }
    function candidate() {
        const config = structuredClone(app.config);

        for (const [key, value] of Object.entries(drafts)) {
            const path = settings().fields[key].path;
            read(config, path.slice(0, -1))[path.at(-1)] = value;
        }

        return config;
    }
    const outputNames = (item) => item.targets.map((id) => settings().outputs.find((target) => target.id === id).name);
    const uses = (keys) => [...new Set(keys.flatMap((key) => views().filter((item) => item.keys.includes(key)).flatMap((item) => item.targets.filter((target) => !settings().fields[key].targets || settings().fields[key].targets.includes(target)))))]
        .map((id) => settings().outputs.find((target) => target.id === id).name);
    const value = (key) => Object.hasOwn(drafts, key) ? drafts[key] : read(app.config, settings().fields[key].path);
    function render() {
        const current = view(), declaration = settings(), fields = declaration.fields;
        const label = (item) => outputNames(item).join(" ｜ ");
        const choices = ui.options(views().map((v) => ({ id: v.id, name: label(v) })), current.id);
        const available = categories();
        const categoryName = (name) => {
            let depth = 0, parent = declaration.categoryParents?.[name];

            while (parent && available.includes(parent)) { depth++; parent = declaration.categoryParents?.[parent]; }

            return "\u3000".repeat(depth) + name;
        };
        return '<section><h2>' + esc(declaration.title) + '</h2>' +
            '<label>编辑命令或变量<select id="' + id + 'CopyCategory">' + choices + '</select></label>' +
            (available.length > 1 ? '<label>文案分类<select id="' + id + 'CopyGroup">' + ui.options(available.map((name) => ({ id: name, name: categoryName(name) })), category()) + '</select></label>' : '') +
            (branches().length > 1 ? '<label>编辑分支<select id="' + id + 'CopyBranch">' + ui.options(branches().map((key) => ({ id: key, name: fields[key].label })), branch()) + '</select></label>' : '') +
            (declaration.description ? '<p class="muted">' + esc(declaration.description) + '</p>' : '') +
            preview.render([branch()].map((key) => ({
                ...fields[key], id: fieldId(key), wrapperId: id + '-copy-field-' + key,
                value: value(key),
                uses: fields[key].uses || (fields[key].targets ? fields[key].targets.map((id) => declaration.outputs.find((target) => target.id === id).name) : uses([key])),
            })), { variablesId: declaration.variablesId, variableCompositions: declaration.variableCompositions }) +
            '<div class="actions">' + btn('保存全部修改', 'save-' + actionId, '', 'primary') + btn('恢复默认', 'reset-' + actionId) + btn('取消', 'cancel-' + actionId) + '</div>' + preview.reference() + '</section>';
    }
    async function action(a) {
        if (await preview.action(a)) { return; }

        if (a === 'cancel-' + actionId) {
            app.render();
        } else if (a === 'save-' + actionId) {
            for (const [key, field] of Object.entries(settings().fields)) {
                try {
                    validateCopyText(value(key), { ...field, variables: Object.keys(field.variables) });
                } catch {
                    selected = view().keys.includes(key) ? view().id : views().find((item) => item.keys.includes(key)).id;
                    selectedCategory = field.category; selectedBranch = key;
                    preview.selectBranch(); app.render(); app.focus(fieldId(key));
                    return;
                }
            }

            app.config = candidate();
            await app.save(undefined, () => { drafts = {}; });
        } else if (a === 'reset-' + actionId) {
            const fields = settings().fields;

            if (!(await app.confirmAction('恢复当前显示的文案？涉及 ' + uses([branch()]).join('、') + '，保存后生效'))) { return; }

            drafts[branch()] = fields[branch()].default;

            app.dirty = true;
            app.render();
        }
    }
    return {
        render, action, refresh: preview.refresh,
        input(el) {
            if (preview.input(el)) { return; }

            const key = [branch()].find((key) => fieldId(key) === el.id);

            if (key) { drafts[key] = el.value; }
        },
        change(el) {
            if (preview.change(el)) { return; }

            if (el.id === id + 'CopyCategory') { selected = el.value; selectedCategory = undefined; selectedBranch = undefined; } else if (el.id === id + 'CopyGroup') { selectedCategory = el.value; selectedBranch = undefined; } else if (el.id === id + 'CopyBranch') { selectedBranch = el.value; } else { return; }

            preview.selectBranch(); app.render();
        },
        reset() { drafts = {}; },
        discardActions: ['cancel-' + actionId],
        get transientInputs() { return [id + 'CopyCategory', id + 'CopyGroup', id + 'CopyBranch', ...preview.transientInputs]; },
    };
}
`;
