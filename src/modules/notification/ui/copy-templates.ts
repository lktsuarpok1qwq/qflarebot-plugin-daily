export const copyTemplates = String.raw`
function createCopyTemplates(app, ui) {
    const { $, esc, uid, field, btn, table, put, mergeDraft } = ui;
    let editing, original;
    const preview = createMessageEditor(app, ui, {
        id: "template", samples: () => messageSamples(app.state.copySamples, editing.body),
        renderSample: (sample, mark) => [{ text: mark(inlineCommandTools.expand($("templateBody").value, {}, sample.values)) }],
        currentValue: () => $("templateBody").value,
        sampleHint: "虚构数据，使用模块默认文案在本地组合，不查询接口",
    });
    function render() {
        let html =
            '<section><h2>通知模板</h2><p class="muted">修改模板会同步影响使用它的任务</p>' +
            btn("新建模板", "new-template", "", "primary") +
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
                "<section><h2>编辑模板</h2>" +
                (used.length
                    ? '<p class="notice">用于：' +
                    used.map((t) => "<strong>" + esc(t.name) + "</strong>").join("、") +
                    "</p>"
                    : "") +
                field("模板名称", "templateName", editing.name) +
                preview.render([{ id: "templateBody", allowEmpty: true, label: "消息内容", value: editing.body, variables: app.state.variableDescriptions }], { variableGroups: app.state.variableGroups }) +
                btn("保存模板", "save-template", "", "primary") +
                btn("取消", "cancel-template") + preview.reference() +
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

        if (a === "cancel-template") {
            app.config = structuredClone(app.state.config);
            app.dirty = false;
            reset();
            app.render();
            app.focus("app");
            return;
        }

        if (a === "save-template") {
            if (!preview.validate()) { return; }

            capture();
            put(app.config.templates, mergeDraft(app.config.templates.find((t) => t.id === editing.id), original, editing));
            await app.save("模板已保存", reset);
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
        discardActions: ["new-template", "edit-template", "delete-template"],
        render,
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
