export const copyTemplates = String.raw`
function createCopyTemplates(app, ui) {
    const { $, esc, uid, field, btn, table, put, mergeDraft } = ui;
    let editing, original;
    const preview = createMessageEditor(app, ui, {
        id: "template", buttons: () => editing ? { rows: editing.buttons ??= [], replace: rows => { editing.buttons = rows; } } : null, context: () => editing?.id || "template", samples: () => messageSamples(app.state.copySamples, editing.body),
        renderSample: (sample, mark) => [{ text: mark(inlineCommandTools.expand($("templateBody").value, {}, sample.values)) }],
        currentValue: () => $("templateBody").value,
        sampleHint: "虚构数据，使用模块默认文案在本地组合，不查询接口",
    });

    function render() {
        let html =
            '<section>' + ui.sectionHeader('通知模板', btn("新建模板", "new-template", "", "primary")) + '<p class="muted">修改模板会同步影响使用它的任务</p>' +
            table(
                ["名称", "使用情况", "操作"],
                app.config.templates.map(
                    (t) =>
                        "<tr><td>" +
                        esc(t.name) +
                        "</td><td>" +
                        app.config.tasks.filter((task) => task.templateId === t.id).length +
                        " 个任务</td><td>" +
                        btn("编辑", "edit-template", t.id) +
                        btn("删除", "delete-template", t.id, "danger") +
                        "</td></tr>",
                ),
            ) +
            "</section>";

        if (editing) {
            const used = app.config.tasks.filter((task) => task.templateId === editing.id);
            html +=
                '<section>' + ui.sectionHeader('编辑模板', btn('关闭编辑', 'close-template')) +
                (used.length
                    ? '<p class="notice">用于：' +
                    used.map((t) => "<strong>" + esc(t.name) + "</strong>").join("、") +
                    "</p>"
                    : "") +
                field("模板名称", "templateName", editing.name, "text", false, { required: true, maxCodePoints: 80 }) +
                preview.render([{ id: "templateBody", allowEmpty: true, label: "消息内容", value: editing.body, variables: app.state.variableDescriptions }], { variableGroups: app.state.variableGroups }) +
                preview.reference() + preview.buttonSection() + '<div class="actions">' + btn("保存全部修改", "save-template", "", "primary") +
                btn("恢复当前默认", "reset-template") + btn("撤销全部修改", "revert-template") + '</div>' +
                "</section>";
        }

        return html;
    }

    function capture() {
        if (editing && $("templateName")) {
            editing.name = $("templateName").value;
            editing.body = $("templateBody").value;
        }
    }

    function reset() {
        editing = null;
    }

    async function action(a, id) {
        if (await preview.action(a)) { return; }

        if (a === "new-template" || a === "edit-template") {
            editing =
                a === "new-template"
                    ? { ...structuredClone(app.state.draftDefaults.template), id: uid() }
                    : structuredClone(app.config.templates.find((t) => t.id === id));
            original = a === "edit-template" ? structuredClone(editing) : undefined;
            app.render();
            app.focus("templateName");

            return;
        }

        if (a === 'reset-template') {
            if (!await app.confirmAction('恢复当前模板文案和按钮默认草稿？保存后影响所有引用任务')) { return; }

            editing.buttons = structuredClone(app.state.draftDefaults.template.buttons || []);
            preview.refreshButtons();
            $("templateBody").value = app.state.draftDefaults.template.body;
            $("templateBody").dispatchEvent(new Event('input', { bubbles: true }));
            app.refresh();

            return;
        }

        if (a === 'revert-template') {
            if (!await app.confirmAction('撤销当前模板全部未保存的修改？')) { return; }

            editing = structuredClone(original || { ...app.state.draftDefaults.template, id: editing.id });
            app.render();

            return;
        }

        if (a === "close-template") {
            app.config = structuredClone(app.state.config);
            app.dirty = false;
            reset();
            app.render();
            app.focus("app");

            return;
        }

        if (a === "save-template") {
            const invalid = ui.validateFields(['templateName']);

            if (invalid) {
                app.focus(invalid);

                return;
            }

            if (!preview.validate(true)) { return; }

            capture();
            put(app.config.templates, mergeDraft(app.config.templates.find((t) => t.id === editing.id), original, editing));
            await app.save("模板已保存", () => {
                editing = structuredClone(app.state.config.templates.find(item => item.id === editing.id));
                original = structuredClone(editing);
            });
            app.focus("app");

            return;
        }

        if (a === "delete-template") {
            if (app.config.tasks.some((t) => t.templateId === id)) {
                throw Error("模板仍被任务使用，请先为这些任务切换模板");
            }

            if (!(await app.confirmAction("删除这个未使用的模板？"))) {
                return;
            }

            app.config.templates = app.config.templates.filter((t) => t.id !== id);
            await app.save("模板已删除", reset);
        }
    }

    return {
        isNew: () => Boolean(editing && !original),
        buttonsDirty: () => Boolean(editing && JSON.stringify(editing.buttons || []) !== JSON.stringify(original?.buttons || [])),
        discardActions: ["new-template", "edit-template", "delete-template", "close-template"],
        render,
        remember: preview.remember,
        refresh: preview.refresh,
        action,
        reset,
        change: preview.change,
        get transientInputs() { return preview.transientInputs; },
        input(el) {
            if (el.id === "templateBody") { editing.body = el.value; }

            return preview.input(el);
        },
    };
}
`;
