export const copyPage = String.raw`
function createCopyPage(app, ui) {
    const { $, esc, options, btn, markdown, showMessage, toolbar } = ui;
    let selectedCommand = "每日",
        selectedCopyTask,
        copySection = "task",
        lastReplyField = "reply-body";
    const replyLabels = {
        body: "完整回复 / 外层模板",
        item: "放假安排条目",
        reference: "节日日期条目（安排待公布）",
        event: "自定义节日条目",
        empty: "没有剩余记录",
        unknown: "没有可靠数据",
        stale: "旧数据提示",
        ongoing: "进行中提示",
        makeupEmpty: "没有调休上班日时的文字",
        error: "查询失败提示",
        tooLong: "平台返回超限时的提示",
    };
    function captureReply() {
        if (!$("reply-body")) {
            return;
        }

        const reply = app.config.replies[selectedCommand];

        for (const key of Object.keys(replyLabels)) {
            if ($("reply-" + key)) {
                reply[key] = $("reply-" + key).value;
            }
        }
    }
    function captureCopy() {
        if (app.page !== "copy") {
            return;
        }

        if (copySection === "task" && $("taskBody")) {
            app.config.tasks.find((t) => t.id === selectedCopyTask).body = $("taskBody").value;
        }

        if (copySection === "command") {
            captureReply();
        }

        if (copySection === "calendar") {
            for (const key of Object.keys(app.config.calendarCopy)) {
                app.config.calendarCopy[key] = $("calendar-copy-" + key).value;
            }
        }
    }
    function render() {
        let html = "";

        html +=
            '<section><h2>文案设置</h2><label>分类<select id="copySection">' +
            options(
                [
                    { id: "task", name: "通知任务" },
                    { id: "command", name: "命令回复" },
                    { id: "calendar", name: "日历占位符" },
                ],
                copySection,
            ) +
            "</select></label></section>";

        if (copySection === "task") {
            if (!app.config.tasks.some((t) => t.id === selectedCopyTask)) {
                selectedCopyTask = app.config.tasks[0]?.id;
            }

            const task = app.config.tasks.find((t) => t.id === selectedCopyTask);
            html += "<section><h2>通知文案</h2>";

            if (task) {
                html +=
                    '<label>任务<select id="copyTask">' +
                    options(app.config.tasks, selectedCopyTask) +
                    "</select></label>" +
                    '<label>消息内容（Markdown）<textarea id="taskBody">' +
                    esc(task.body) +
                    "</textarea></label>" +
                    toolbar("taskBody") +
                    '<div class="actions">' +
                    app.state.variables.map((v) => btn("{{" + v + "}}", "insert-variable", v)).join("") +
                    "</div>" +
                    '<p class="muted">该任务的所有对象使用同一份文案。标题、换行和模块顺序直接写在这里；预览只读取本地缓存。</p>' +
                    btn("保存文案", "save-copy", "", "primary") +
                    btn("预览公告", "preview-task") +
                    '<div id="taskPreview" class="message-preview" hidden></div>';
            } else {
                html += "<p>请先创建通知任务。</p>";
            }

            html += "</section>";
        }

        if (copySection === "command") {
            const reply = app.config.replies[selectedCommand];
            html +=
                '<section><h2>命令回复</h2><label>命令<select id="commandName">' +
                Object.keys(app.config.replies)
                    .map(
                        (name) =>
                            "<option " + (name === selectedCommand ? "selected" : "") + ">" + esc(name) + "</option>",
                    )
                    .join("") +
                "</select></label>";

            for (const [key, label] of Object.entries(replyLabels)) {
                if (
                    !["假期 下一个", "假期 剩余"].includes(selectedCommand) &&
                    !["body", "error", "tooLong"].includes(key)
                ) {
                    continue;
                }

                html +=
                    "<label>" +
                    label +
                    '<textarea id="reply-' +
                    key +
                    '">' +
                    esc(reply[key]) +
                    "</textarea></label>" +
                    toolbar("reply-" + key);
            }

            html +=
                '<div class="actions" id="replyVariables">' +
                app.state.replyVariables[selectedCommand].body
                    .map((v) => btn("{{" + v + "}}", "reply-variable", v))
                    .join("") +
                '</div><p class="muted">变量插入当前编辑框；items 用于完整回复，条目中使用 name、start/end 等变量。条目之间的换行请直接写在条目模板末尾。</p>' +
                btn("保存文案", "save-copy", "", "primary") +
                btn("恢复当前命令默认", "reset-reply") +
                btn("使用本地数据预览", "preview-reply") +
                '<div id="replyPreview" class="message-preview">' +
                markdown(reply.body) +
                "</div></section>";
        }

        if (copySection === "calendar") {
            html +=
                '<section><h2>日历占位符文案</h2><p class="muted">下一个用于 {{日历.下一个}}；日历.今年剩余 使用各类条目及剩余外层模板，今日文案用于 {{日历.今日}}。概览支持 {{name}}、{{start}}、{{end}}、{{days_until}}、{{days_off}}、{{ongoing}}；节日日期概览支持 {{name}}、{{date}}、{{days_until}}。条目末尾自行填写换行。自定义节日支持 name、date、days_until；今日节日支持 name。{{日历.今日节日}} 仅输出当天自定义节日或已知的节日日期，没有条目时为空，可单独用作节日提醒。仅有节日日期时，{{日历.节日日期}} 有值，开始日期、结束日期和天数为空。放假与调休今日文案支持 {{name}}。</p>' +
                Object.entries({
                    summary: "放假条目",
                    reference: "节日日期概览（安排待公布）",
                    event: "自定义节日条目",
                    eventToday: "今日自定义节日",
                    remaining: "今年剩余外层模板（items、count、year、today、stale）",
                    today: "今日放假",
                    makeupToday: "今日调休上班",
                    ordinary: "普通日期",
                    unknown: "暂无数据",
                    none: "已无剩余假期",
                    ongoing: "进行中",
                    stale: "缓存提示",
                })
                    .map(
                        ([key, label]) =>
                            "<label>" +
                            label +
                            '<textarea id="calendar-copy-' +
                            key +
                            '">' +
                            esc(app.config.calendarCopy[key]) +
                            "</textarea></label>",
                    )
                    .join("") +
                btn("保存日历文案", "save-copy", "", "primary") +
                btn("恢复日历默认文案", "reset-calendar-copy") +
                "</section>";
        }

        return html;
    }
    async function action(a, id) {
        if (a === "preview-task") {
            captureCopy();
            showMessage("taskPreview", await app.api("preview", { config: app.config, taskId: selectedCopyTask }));
            return;
        }

        if (a === "insert-variable") {
            const area = $("taskBody");
            area.setRangeText("{{" + id + "}}", area.selectionStart, area.selectionEnd, "end");
            area.dispatchEvent(new Event("input", { bubbles: true }));
            return;
        }

        if (a === "markup") {
            const { id: target, before, after } = JSON.parse(id),
                el = $(target);
            const selected = el.value.slice(el.selectionStart, el.selectionEnd) || "文字";
            el.setRangeText(before + selected + after, el.selectionStart, el.selectionEnd, "end");
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.focus();
            return;
        }

        if (a === "reply-variable") {
            const el = $(lastReplyField) || $("reply-body");
            el.setRangeText("{{" + id + "}}", el.selectionStart, el.selectionEnd, "end");
            el.dispatchEvent(new Event("input", { bubbles: true }));
            return;
        }

        if (a === "save-copy") {
            captureCopy();
            await app.save();
            return;
        }

        if (a === "reset-calendar-copy") {
            if (!(await app.confirmAction("恢复全部日历占位符默认文案？当前自定义文案将被覆盖。"))) {
                return;
            }

            app.config.calendarCopy = structuredClone(app.state.calendarDefaults);
            await app.save();
            return;
        }

        if (a === "reset-reply") {
            if (!(await app.confirmAction("恢复当前命令的默认文案？该命令的自定义文案将被覆盖。"))) {
                return;
            }

            app.config.replies[selectedCommand] = structuredClone(app.state.replyDefaults[selectedCommand]);
            await app.save();
            return;
        }

        if (a === "preview-reply") {
            captureReply();
            showMessage(
                "replyPreview",
                await app.api("command-preview", { config: app.config, command: selectedCommand }),
            );
            return;
        }
    }

    function selectTask(id) {
        copySection = "task";
        selectedCopyTask = id;
    }
    function change(el) {
        if (el.id === "copySection" || el.id === "copyTask") {
            captureCopy();

            if (el.id === "copySection") {
                copySection = el.value;
            } else {
                selectedCopyTask = el.value;
            }

            app.render();
        }

        if (el.id === "commandName") {
            captureReply();
            selectedCommand = el.value;
            app.render();
        }
    }
    function input(el) {
        if (el.id.startsWith("reply-")) {
            captureReply();
            showMessage("replyPreview", { text: app.config.replies[selectedCommand].body });
        }
    }
    function focus(el) {
        if (el.id.startsWith("reply-")) {
            lastReplyField = el.id;
            $("replyVariables").innerHTML = app.state.replyVariables[selectedCommand][el.id.slice(6)]
                .map((v) => btn("{{" + v + "}}", "reply-variable", v))
                .join("");
        }
    }

    return { render, action, selectTask, change, input, focus };
}
`;
