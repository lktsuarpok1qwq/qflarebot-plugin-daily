export const copyEditor = String.raw`
function createCopyEditor(app, ui, id = app.id, extensions = {}) {
    const { esc, btn } = ui;
    const settings = () => app.state.copyEditor;
    const actionId = id + "-copy";
    let selected, drafts = {}, buttonDrafts = {}, buttonBaselines = {};
    const selections = new Map();
    const views = () => settings().views;
    const view = () => views().find((item) => item.id === (selected ?? settings().initial)) || views()[0];
    const categories = () => [...new Set(view().keys.map((key) => settings().fields[key].category))];
    const category = () => categories().includes(selections.get(view().id)?.category) ? selections.get(view().id).category : categories()[0];
    const branches = () => view().keys.filter((key) => settings().fields[key].category === category());
    const branch = () => branches().includes(selections.get(view().id)?.branch) ? selections.get(view().id).branch : branches()[0];
    const buttonTarget = () => settings().outputs.find(output => view().targets.includes(output.id) && !output.variable)?.id;
    const buttonRows = () => {
        const key = buttonTarget();

        return key ? buttonDrafts[key] ?? app.config.buttons?.[key] ?? [] : [];
    };
    const editButtons = () => buttonTarget() && settings().fields[branch()].buttons !== false && !settings().categoryParents?.[settings().fields[branch()].category]
        ? { rows: buttonRows(), replace: rows => { buttonDrafts[buttonTarget()] = rows; } } : null;
    const fieldId = key => settings().fields[key].inputId || id + "CopyBody";
    const read = (config, path) => path.reduce((value, key) => value[key], config) ?? "";
    const preview = createMessageEditor(app, ui, {
        id, buttons: () => {
            if (!editButtons()) { return null; }

            const key = buttonTarget();

            if (!Object.hasOwn(buttonDrafts, key)) {
                buttonDrafts[key] = structuredClone(app.config.buttons?.[key] || []);
                buttonBaselines[key] = JSON.stringify(buttonDrafts[key]);
            }

            return editButtons();
        }, previewButtons: buttonRows, context: () => view().id + "/" + branch(), currentValue: () => value(branch()), preserveWhitespace: () => settings().fields[branch()].presentation === "separator",
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

        const changedButtons = Object.fromEntries(Object.entries(buttonDrafts).filter(([key, rows]) => JSON.stringify(rows) !== buttonBaselines[key]));

        if (Object.keys(changedButtons).length) {
            config.buttons = { ...config.buttons, ...structuredClone(changedButtons) };
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

            while (parent && available.includes(parent)) {
                depth++;
                parent = declaration.categoryParents?.[parent];
            }

            return "\u3000".repeat(depth) + name;
        };

        return '<section id="' + id + 'CopyEditor">' +
            (views().length > 1 ? '<label>编辑命令或变量<select id="' + id + 'CopyCategory">' + choices + '</select></label>' : '') +
            (available.length > 1 ? '<label>模板分类<select id="' + id + 'CopyGroup">' + ui.options(available.map((name) => ({ id: name, name: categoryName(name) })), category()) + '</select></label>' : '') +
            (branches().length > 1 ? '<label>编辑分支<select id="' + id + 'CopyBranch">' + ui.options(branches().map((key) => ({ id: key, name: fields[key].label })), branch()) + '</select></label>' : '') +
            (declaration.description ? '<p class="muted">' + esc(declaration.description) + '</p>' : '') +
            preview.render([branch()].map((key) => ({
                ...fields[key], id: fieldId(key), single: branches().length === 1, fragment: fields[key].buttons === false || !!declaration.categoryParents?.[fields[key].category], wrapperId: id + '-copy-field-' + key,
                value: value(key),
                uses: fields[key].uses || (fields[key].targets ? fields[key].targets.map((id) => declaration.outputs.find((target) => target.id === id).name) : uses([key])),
            })), { variablesId: declaration.variablesId, variableCompositions: declaration.variableCompositions }) +
            preview.reference() + preview.buttonSection() + '<div id="' + id + 'CopyActions" class="actions">' + btn('保存全部修改', 'save-' + actionId, '', 'primary') + btn('恢复当前默认', 'reset-' + actionId) + btn('撤销全部修改', 'cancel-' + actionId) + '</div></section>';
    }

    async function action(a) {
        if (await preview.action(a)) { return; }

        if (a === 'cancel-' + actionId) {
            app.render();
        } else if (a === 'save-' + actionId) {
            for (const [key, field] of Object.entries(settings().fields)) {
                try {
                    validateCopyText(value(key), { ...field, variables: Object.keys(field.variables) });
                } catch (error) {
                    selected = view().keys.includes(key) ? view().id : views().find((item) => item.keys.includes(key)).id;
                    selections.set(selected, { category: field.category, branch: key });
                    app.render();
                    app.focus(fieldId(key), error.start ?? 0, error.end ?? value(key).length);

                    return;
                }
            }

            for (const [key, rows] of Object.entries(buttonDrafts)) {
                if (!messageButtonError(rows)) { continue; }

                selected = views().find(item => item.targets.includes(key)).id;
                selections.delete(selected);
                app.render();
                preview.validateButtons(true);

                return;
            }

            app.config = candidate();
            await app.save(undefined, () => {
                drafts = {};
                buttonDrafts = {};
                buttonBaselines = {};
            });
        } else if (a === 'reset-' + actionId) {
            const fields = settings().fields;

            if (!(await app.confirmAction('恢复“' + settings().fields[branch()].label + '”默认草稿？涉及 ' + uses([branch()]).join('、') + (editButtons() ? '；包含当前消息按钮' : '') + '，保存后生效'))) { return; }

            drafts[branch()] = fields[branch()].default;

            if (editButtons()) { buttonDrafts[buttonTarget()] = []; }

            app.dirty = true;
            app.render();
        }
    }

    return {
        render, action, remember: preview.remember, refresh: preview.refresh,
        isDirty: () => Object.entries(drafts).some(([key, text]) => text !== read(app.state.config, settings().fields[key].path))
            || Object.entries(buttonDrafts).some(([key, rows]) => JSON.stringify(rows) !== buttonBaselines[key]),
        input(el) {
            if (!app.state?.copyEditor) { return; }

            const key = [branch()].find((key) => fieldId(key) === el.id);

            if (key) { drafts[key] = el.value; }

            preview.input(el);
        },
        change(el) {
            if (!app.state?.copyEditor) { return; }

            preview.remember();

            if (preview.change(el)) { return; }

            if (el.id === id + 'CopyCategory') {
                selected = el.value;
            } else if (el.id === id + 'CopyGroup') {
                selections.set(view().id, { category: el.value });
            } else if (el.id === id + 'CopyBranch') { selections.set(view().id, { category: category(), branch: el.value }); } else { return; }

            app.render();
        },
        reset() {
            drafts = {};
            buttonDrafts = {};
            buttonBaselines = {};
        },
        discardActions: ['cancel-' + actionId],
        get transientInputs() { return [id + 'CopyCategory', id + 'CopyGroup', id + 'CopyBranch', ...preview.transientInputs]; },
    };
}
`;
