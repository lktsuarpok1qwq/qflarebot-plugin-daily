export const tasksPage = String.raw`
function createTasksPage(app, ui) {
    const { $, esc, uid, time, options, field, check, btn, table, showMessage, put } = ui;
    let editingTask, testingTask;
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
            box.textContent = "未获得发送结果：" + error.message + "。再次点击将查询同一次测试结果。";
            throw error;
        }
    }
    function render() {
        let html = "";

        html +=
            '<section><h2>发送计划</h2><p class="muted">任务使用 Markdown 文案，通过占位符组合模块信息。先创建任务，再在任务内勾选发送对象。消息内容统一在文案设置中编辑。</p>' +
            btn("新建任务", "new-task", "", "primary");
        html +=
            table(
                ["任务", "周期 / 北京时间", "目标 / 状态", "操作"],
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
                        btn("文案", "task-copy", t.id) +
                        btn("立即测试", "test-task", t.id) +
                        btn(t.enabled ? "暂停" : "启用", "toggle-task", t.id) +
                        btn("复制", "copy-task", t.id) +
                        btn("删除", "delete-task", t.id, "danger") +
                        "</td></tr>",
                ),
            ) + "</section>";

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
                    '</h2><p class="muted">立即向选中的对象发送该任务已保存的文案。无需启用任务，不改变定时计划。</p>' +
                    '<label>测试对象<select id="testRecipient">' +
                    options(targets) +
                    "</select></label>" +
                    btn("发送测试消息", "send-task-test", task.id, "primary") +
                    '<div id="testMessage" class="message-preview" hidden></div><pre id="testResult" role="status" hidden></pre></section>';
            }
        }

        if (editingTask) {
            const t = editingTask,
                s = t.schedule;
            html +=
                '<section><h2>编辑任务</h2><div class="grid">' +
                field("名称", "taskName", t.name) +
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
                field("北京时间", "scheduleTime", s.time, "time") +
                '<div id="weeklyFields"' +
                (s.kind === "weekly" ? "" : " hidden") +
                ">" +
                field("每周星期（1–7，逗号分隔）", "weekdays", (s.weekdays || [1]).join(",")) +
                "</div>" +
                '<div id="onceFields"' +
                (s.kind === "once" ? "" : " hidden") +
                ">" +
                field("一次性日期", "onceDate", s.date || "", "date") +
                "</div>" +
                check("启用任务", "taskEnabled", t.enabled) +
                "</div>" +
                (app.state.config.tasks.some((task) => task.id === t.id)
                    ? '<fieldset><legend>发送对象</legend><div class="grid">' +
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
                                  (r.enabled ? "" : "（已停用）") +
                                  "</label>",
                          )
                          .join("") +
                      (app.config.recipients.length ? "" : "<p>请先在发送对象页面添加群聊或私聊。</p>") +
                      "</div></fieldset>"
                    : '<p class="muted">保存任务后即可选择发送对象。</p>') +
                '<div class="actions">' +
                btn("保存任务", "save-task", "", "primary") +
                btn("取消", "cancel-task") +
                "</div></section>";
        }

        return html;
    }
    async function action(a, id) {
        if (a === "new-task") {
            editingTask = {
                ...structuredClone(app.state.draftDefaults.task),
                id: uid(),
                origin: "manual",
                enabled: false,
                schedule: { kind: "daily", time: "09:00" },
            };
            app.render();
            return;
        }

        if (a === "test-task") {
            if (app.dirty) {
                throw Error("请先保存文案，再测试发送");
            }

            if (!app.config.bindings.some((b) => b.taskId === id)) {
                throw Error("请先为该任务绑定发送对象");
            }

            testingTask = id;
            app.render();
            $("eventTest").scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }

        if (a === "send-task-test") {
            await sendTest(id, $("testRecipient").value, "testMessage", "testResult");
            return;
        }

        if (a === "edit-task") {
            editingTask = structuredClone(app.config.tasks.find((t) => t.id === id));
            app.render();
            return;
        }

        if (a === "cancel-task") {
            app.config = structuredClone(app.state.config);
            app.dirty = false;
            editingTask = null;
            app.render();
            return;
        }

        if (a === "save-task") {
            const s = { kind: $("kind").value, time: $("scheduleTime").value };

            if (s.kind === "weekly") {
                s.weekdays = $("weekdays").value.split(",").map(Number);
            }

            if (s.kind === "once") {
                s.date = $("onceDate").value;
            }

            const current = app.config.tasks.find((t) => t.id === editingTask.id);
            put(app.config.tasks, {
                ...(current ?? editingTask),
                name: $("taskName").value,
                enabled: $("taskEnabled").checked,
                schedule: s,
            });

            if (app.state.config.tasks.some((t) => t.id === editingTask.id)) {
                const selected = new Set(
                    [...document.querySelectorAll("[data-task-recipient]:checked")].map(
                        (el) => el.dataset.taskRecipient,
                    ),
                );
                app.config.bindings = app.config.bindings.filter(
                    (b) => b.taskId !== editingTask.id || selected.has(b.recipientId),
                );

                for (const recipientId of selected) {
                    if (
                        !app.config.bindings.some((b) => b.taskId === editingTask.id && b.recipientId === recipientId)
                    ) {
                        app.config.bindings.push({ taskId: editingTask.id, recipientId });
                    }
                }
            }

            const savedId = editingTask.id;
            await app.save();
            editingTask = structuredClone(app.config.tasks.find((t) => t.id === savedId));
            app.render();
            return;
        }

        if (a === "task-copy") {
            editingTask = null;
            app.openCopy(id);
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
            await app.save();
            return;
        }
    }
    function reset() {
        editingTask = null;
    }
    function change(el) {
        if (el.id === "kind") {
            $("weeklyFields").hidden = el.value !== "weekly";
            $("onceFields").hidden = el.value !== "once";
        }
    }
    return { render, action, reset, change };
}
`;
