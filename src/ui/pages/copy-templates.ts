export const copyTemplates = String.raw`
function createCopyTemplates(app, ui) {
    const { $, esc, uid, field, btn, table, toolbar, put, showMessage, mergeDraft } = ui;
    let editing, original;
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
                '<div class="markdown-workspace"><div class="markdown-editor"><label>消息内容（Markdown）<textarea id="templateBody">' +
                esc(editing.body) +
                "</textarea></label>" +
                toolbar("templateBody") +
                "</div>" +
                ui.previewPanel() +
                "</div>" +
                ui.variableReference(
                    [{ label: "消息内容", variables: app.state.variables }],
                    app.state.variableDescriptions,
                    app.state.variableGroups,
                ) +
                btn("保存模板", "save-template", "", "primary") +
                btn("取消", "cancel-template") +
                btn("实际预览", "preview-template") +
                '<p id="templatePreviewHint" class="muted">点击“实际预览”替换变量</p><div id="templatePreview" class="message-preview" hidden></div>' +
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
        if (a === "preview-template") {
            capture();
            const config = structuredClone(app.config);
            put(config.templates, structuredClone(editing));
            invalidate("正在预览…");

            try {
                showMessage("templatePreview", await app.api("preview", { config, templateId: editing.id }));
                $("templatePreviewHint").hidden = true;
            } catch (error) {
                invalidate("预览失败，请重试");
                throw error;
            }

            return;
        }

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
            capture();
            put(app.config.templates, mergeDraft(app.config.templates.find((t) => t.id === editing.id), original, editing));
            await app.save("模板已保存");
            reset();
            app.render();
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
            await app.save("模板已删除");
            reset();
            app.render();
        }
    }
    function invalidate(text = "内容已变化，请重新预览") {
        $("templatePreview").hidden = true;
        $("templatePreviewHint").hidden = false;
        $("templatePreviewHint").textContent = text;
    }
    return {
        render,
        action,
        capture,
        reset,
        input: (el) => {
            if (el.id === "templateBody") {
                invalidate();
            }
        },
    };
}
`;
