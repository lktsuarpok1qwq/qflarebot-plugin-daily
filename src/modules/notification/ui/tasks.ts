export const tasksPage = String.raw`
function createTasksPage(app, ui) {
    const { $, esc, uid, options, field, check, btn, table, showMessage, put, mergeDraft } = ui;
    let editingTask,
        testingTask,
        draftBody = "",
        baseBody = "",
        draftTemplateId,
        originalTask,
        originalTargets;

    const preview = createMessageEditor(app, ui, {
        id: "task", samples: () => messageSamples(app.state.copySamples, draftBody),
        renderSample: (sample, mark) => [{ text: mark(inlineCommandTools.expand($("taskBody").value, {}, sample.values)) }],
        currentValue: () => $("taskBody").value,
        sampleHint: "虚构数据，使用模块默认文案在本地组合，不查询接口",
    });
    function edit(task) {
        editingTask = structuredClone(task);
        originalTask = structuredClone(app.state.config.tasks.find((t) => t.id === task.id));
        originalTargets = new Set(app.config.bindings.filter((b) => b.taskId === task.id).map((b) => b.recipientId));
        baseBody = app.config.templates.find((t) => t.id === task.templateId)?.body || "";
        draftBody = baseBody;
        draftTemplateId = null;
    }
    const testRequests = new Map();
    async function sendTest(taskId, recipientId, previewId, resultId) {
        if (app.dirty) {
            throw Error("请先保存文案，再测试发送");
        }

        const id = taskId + ":" + recipientId;

        if (!testRequests.has(id)) {
            testRequests.set(id, uid());
        }

        const box = $(resultId);
        box.hidden = false;
        box.textContent = "正在发送…";

        try {
            const result = await app.api("test", {
                taskId,
                recipientId,
                requestId: testRequests.get(id),
            });

            if (!["sending", "uncertain"].includes(result.status)) {
                testRequests.delete(id);
            }

            if (result.text !== undefined) {
                showMessage(previewId, result);
            }

            const label = result.ok
                ? "发送成功"
                : result.status === "sending"
                    ? "发送处理中"
                    : result.status === "uncertain"
                        ? "发送结果不确定，请到 QQ 查看"
                        : "发送失败";
            box.textContent =
                label + (result.error ? "：" + result.error : "") + "\n\n" + JSON.stringify(result, null, 2);
            app.status(label, !result.ok);
        } catch (error) {
            box.textContent = "未获得发送结果：" + error.message + "；再次点击可查询本次结果";
            throw error;
        }
    }
    function renderPlans() {
        let html = "";

        html +=
            '<section><h2>发送计划</h2><p class="muted">创建任务、选择模板，保存后配置通知对象</p>' +
            btn("新建任务", "new-task", "", "primary");
        html +=
            table(
                ["任务", "周期 / 时间", "目标 / 状态", "操作"],
                app.config.tasks.map(
                    (t) =>
                        "<tr><td>" +
                        esc(t.name) +
                        "<br><small>" +
                        esc(t.origin === "system" ? "系统自带" : "人工添加") +
                        "</small></td><td>" +
                        esc(
                            t.schedule.kind === "weekly"
                                ? "每周 " + t.schedule.weekdays.map((d) => "星期" + "一二三四五六日"[d - 1]).join("、")
                                : t.schedule.kind === "once"
                                    ? t.schedule.date
                                    : "每日",
                        ) +
                        " " +
                        esc(t.schedule.time) +
                        "</td><td>" +
                        app.config.bindings.filter((b) => b.taskId === t.id).length +
                        " 个 · " +
                        (t.enabled
                            ? t.schedule.kind === "once" &&
                                Date.parse(t.schedule.date + "T" + t.schedule.time + ":00+08:00") < Date.now() &&
                                app.state.cursors.filter((c) => c.task_id === t.id).length &&
                                app.state.cursors.filter((c) => c.task_id === t.id).every((c) => c.due_at === null)
                                ? "已结束"
                                : "启用"
                            : "暂停") +
                        "</td><td>" +
                        btn("编辑", "edit-task", t.id) +
                        btn("立即测试", "test-task", t.id) +
                        btn(t.enabled ? "暂停" : "启用", "toggle-task", t.id) +
                        btn("复制", "copy-task", t.id) +
                        btn("删除", "delete-task", t.id, "danger") +
                        "</td></tr>",
                ),
            ) + "</section>";

        return html;
    }
    const plans = createLazySection(app, ui, "cursors", "发送计划", { render: renderPlans });
    function render() {
        let html = plans.render();

        if (testingTask) {
            const task = app.config.tasks.find((t) => t.id === testingTask);
            const targets = app.config.bindings
                .filter((b) => b.taskId === testingTask)
                .map((b) => app.config.recipients.find((r) => r.id === b.recipientId))
                .filter(Boolean);

            if (task) {
                html +=
                    '<section id="eventTest"><h2>事件测试：' +
                    esc(task.name) +
                    '</h2><p class="muted">发送已保存的文案，不改变定时计划；未接收定时通知的对象也可测试</p>' +
                    '<label>测试对象<select id="testRecipient">' +
                    options(targets) +
                    "</select></label>" +
                    btn("发送测试消息", "send-task-test", task.id, "primary") +
                    btn("关闭测试", "close-test") +
                    '<div id="testMessage" class="message-preview" hidden></div><pre id="testResult" role="status" hidden></pre></section>';
            }
        }

        if (editingTask) {
            const t = editingTask,
                s = t.schedule;
            html +=
                '<section><h2>编辑任务</h2><div class="grid">' +
                field("名称", "taskName", t.name) +
                '<label>通知模板<select id="taskTemplate">' +
                options([{ id: "", name: "不选模板，填写独立文案" }, ...app.config.templates], t.templateId) +
                "</select><small>直接选用会跟随模板更新；改写后只用于当前任务</small></label>" +
                '<label>重复方式<select id="kind">' +
                ["daily", "weekly", "once"]
                    .map(
                        (k, i) =>
                            '<option value="' +
                            k +
                            '" ' +
                            (s.kind === k ? "selected" : "") +
                            ">" +
                            ["每日", "每周", "一次性"][i] +
                            "</option>",
                    )
                    .join("") +
                "</select></label>" +
                field("发送时间", "scheduleTime", s.time, "time") +
                '<div id="weeklyFields"' +
                (s.kind === "weekly" ? "" : " hidden") +
                ">" +
                '<fieldset class="weekdays"><legend>每周星期</legend><div class="actions">' +
                [1, 2, 3, 4, 5, 6, 7]
                    .map((day) =>
                        check("星期" + "一二三四五六日"[day - 1], "weekday-" + day, (s.weekdays || [1]).includes(day)),
                    )
                    .join("") +
                "</div></fieldset>" +
                "</div>" +
                '<div id="onceFields"' +
                (s.kind === "once" ? "" : " hidden") +
                ">" +
                field("一次性日期", "onceDate", s.date || "", "date") +
                "</div>" +
                "</div>" +
                '<fieldset><legend>功能开关</legend>' + check("启用任务", "taskEnabled", t.enabled) + "</fieldset>" +
                preview.render([{ id: "taskBody", allowEmpty: true, label: "消息内容", value: draftBody, variables: app.state.variableDescriptions }], { variableGroups: app.state.variableGroups }) +
                '<p class="muted">改写内容仅用于当前任务，所有通知对象共用</p>' +
                (app.state.config.tasks.some((task) => task.id === t.id)
                    ? '<fieldset><legend>通知对象</legend><div class="grid">' +
                    app.config.recipients
                        .map(
                            (r) =>
                                '<label class="check"><input type="checkbox" id="target-' +
                                esc(r.id) +
                                '" data-task-recipient="' +
                                esc(r.id) +
                                '" ' +
                                (app.config.bindings.some((b) => b.taskId === t.id && b.recipientId === r.id)
                                    ? "checked"
                                    : "") +
                                ">" +
                                esc(r.name || r.openid) +
                                (r.enabled ? "" : "（不接收定时通知）") +
                                "</label>",
                        )
                        .join("") +
                    (app.config.recipients.length ? "" : "<p>请先添加通知对象</p>") +
                    "</div></fieldset>"
                    : '<p class="muted">保存后可选择通知对象</p>') +
                '<div class="actions">' +
                btn("保存任务", "save-task", "", "primary") +
                btn("取消", "cancel-task") + "</div>" + preview.reference() + "</section>";
        }

        return html;
    }
    async function action(a, id) {
        await plans.action(a, id);

        if (await preview.action(a)) { return; }

        if (a === "new-task") {
            edit({
                ...structuredClone(app.state.draftDefaults.task),
                templateId: app.config.templates[0]?.id || "",
                id: uid(),
                origin: "manual",
                enabled: false,
                schedule: { kind: "daily", time: "09:00" },
            });
            app.render();
            app.focus("taskName");
            return;
        }

        if (a === "test-task") {
            if (app.dirty) {
                throw Error("请先保存文案，再测试发送");
            }

            if (!app.config.bindings.some((b) => b.taskId === id)) {
                throw Error("请先为该任务绑定通知对象");
            }

            testingTask = id;
            app.render();
            app.focus("testRecipient");
            return;
        }

        if (a === "close-test") {
            testingTask = null;
            $("eventTest")?.remove();
            app.focus(editingTask ? "taskName" : "app");
            return;
        }

        if (a === "send-task-test") {
            await sendTest(id, $("testRecipient").value, "testMessage", "testResult");
            return;
        }

        if (a === "edit-task") {
            edit(app.config.tasks.find((t) => t.id === id));
            app.render();
            app.focus("taskName");
            return;
        }

        if (a === "cancel-task") {
            app.config = structuredClone(app.state.config);
            app.dirty = false;
            editingTask = null;
            app.render();
            app.focus("app");
            return;
        }

        if (a === "save-task") {
            if (!preview.validate()) { return; }

            const s = { kind: $("kind").value, time: $("scheduleTime").value };

            if (s.kind === "weekly") {
                s.weekdays = [1, 2, 3, 4, 5, 6, 7].filter((day) => $("weekday-" + day).checked);
            }

            if (s.kind === "once") {
                s.date = $("onceDate").value;
            }

            const current = app.config.tasks.find((t) => t.id === editingTask.id);
            const selectedId = $("taskTemplate").value;
            const template = app.config.templates.find((t) => t.id === selectedId);
            draftBody = $("taskBody").value;
            let templateId = selectedId;

            if (selectedId && !template) {
                throw Error("模板已被删除，请重新选择");
            }

            if (!template || (draftBody !== baseBody && draftBody !== template.body)) {
                draftTemplateId ||= uid();
                templateId = draftTemplateId;
                put(app.config.templates, {
                    id: templateId,
                    name: $("taskName").value + app.state.draftDefaults.taskTemplateSuffix,
                    body: draftBody,
                });
            }

            put(app.config.tasks, mergeDraft(current, originalTask, {
                ...editingTask,
                templateId,
                name: $("taskName").value,
                enabled: $("taskEnabled").checked,
                schedule: s,
            }));

            if (app.state.config.tasks.some((t) => t.id === editingTask.id)) {
                const selected = new Set(
                    [...document.querySelectorAll("[data-task-recipient]:checked")].map(
                        (el) => el.dataset.taskRecipient,
                    ),
                );
                app.config.bindings = app.config.bindings.filter(
                    (b) => b.taskId !== editingTask.id || !originalTargets.has(b.recipientId) || selected.has(b.recipientId),
                );

                for (const recipientId of selected) {
                    if (
                        !originalTargets.has(recipientId) &&
                        !app.config.bindings.some((b) => b.taskId === editingTask.id && b.recipientId === recipientId)
                    ) {
                        app.config.bindings.push({ taskId: editingTask.id, recipientId });
                    }
                }
            }

            const savedId = editingTask.id;
            await app.save(undefined, () => edit(app.config.tasks.find((t) => t.id === savedId)));
            return;
        }

        if (a === "copy-task") {
            const t = structuredClone(app.config.tasks.find((t) => t.id === id));
            t.id = uid();
            t.origin = "manual";
            t.name += app.state.draftDefaults.copySuffix;
            t.enabled = false;
            app.config.tasks.push(t);
            await app.save();
            return;
        }

        if (a === "toggle-task") {
            const t = app.config.tasks.find((t) => t.id === id);
            t.enabled = !t.enabled;
            await app.save();
            return;
        }

        if (a === "delete-task") {
            if (!(await app.confirmAction("删除任务及其绑定？"))) {
                return;
            }

            app.config.tasks = app.config.tasks.filter((t) => t.id !== id);
            app.config.bindings = app.config.bindings.filter((b) => b.taskId !== id);
            await app.save(undefined, () => {
                if (editingTask?.id === id) { editingTask = null; }

                if (testingTask === id) { testingTask = null; }
            });
            return;
        }
    }
    function reset() {
        editingTask = null;
        testingTask = null;
    }
    function change(el) {
        if (el.id === "taskTemplate") {
            editingTask.templateId = el.value;
            baseBody = app.config.templates.find((t) => t.id === el.value)?.body || "";
            draftBody = baseBody;
            draftTemplateId = null;
            $("taskBody").value = draftBody;

            preview.refresh();
        }

        if (el.id === "kind") {
            $("weeklyFields").hidden = el.value !== "weekly";
            $("onceFields").hidden = el.value !== "once";
        }
    }
    return {
        discardActions: ["new-task", "edit-task", "copy-task", "toggle-task", "delete-task"],
        get transientInputs() { return ["testRecipient", ...preview.transientInputs]; },
        render,
        refresh() { plans.refresh(); preview.refresh(); },
        action,
        reset,
        change(el) { if (!preview.change(el)) { change(el); } },
        input(el) {
            if (el.id === "taskBody") { draftBody = el.value; }

            return preview.input(el);
        },
    };
}
`;
