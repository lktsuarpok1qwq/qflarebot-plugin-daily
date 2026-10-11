export const calendarCopyPage = String.raw`
function createCalendarCopyPage(app, ui) {
    const { $, esc, btn, showMessage, toolbar } = ui;
    const variableLabels = {
        name: "节日名称",
        date: "节日日期",
        start: "开始日期",
        end: "结束日期",
        days_off: "放假天数",
        days_until: "距开始天数，进行中为 0",
        ongoing: "进行中提示",
        makeup: "调休日期",
        source: "数据来源",
        year: "当前年份",
        today: "今天日期",
    };
    const fields = {
        summary: ["放假", ["/假期 下个", "/假期 剩余", "公告"]],
        reference: ["节日日期 · 安排待公布", ["/假期 下个", "/假期 剩余", "公告"]],
        event: ["自定义节日", ["/假期 下个", "/假期 剩余", "公告"]],
        ongoing: ["进行中", ["/假期 剩余", "公告"]],
        makeupEmpty: ["无调休", ["/假期 下个", "/假期 剩余", "公告"]],
        today: ["今日放假", ["公告"]],
        makeupToday: ["今日调休", ["公告"]],
        eventToday: ["今日节日", ["公告"]],
        ordinary: ["普通日期 · 留空不提醒", ["公告"]],
        help: ["帮助", ["/假期"]],
        none: ["无后续节日", ["/假期 下个"]],
        noneRemaining: ["今年无剩余节日", ["/假期 剩余"]],
        unknown: ["数据未知", ["/假期 下个", "/假期 剩余"]],
        stale: ["使用缓存", ["/假期 下个", "/假期 剩余", "公告"]],
    };
    const views = {
        help: { label: "/假期", keys: ["help"] },
        next: {
            label: "/假期 下个",
            keys: ["summary", "reference", "event", "makeupEmpty", "none", "unknown", "stale"],
        },
        remaining: {
            label: "/假期 剩余",
            keys: ["summary", "reference", "event", "ongoing", "makeupEmpty", "noneRemaining", "unknown", "stale"],
        },
        today: { label: "今日信息", keys: ["today", "makeupToday", "eventToday", "ordinary", "stale"] },
    };
    let category = "commands",
        command = "help",
        drafts = {};
    const view = () => views[category === "commands" ? command : "today"];
    const uses = (names) => names.map((name) => "<strong>" + esc(name) + "</strong>").join("、");
    function variables() {
        const keys = view().keys;
        const unsupported = keys.filter((key) => !app.state.calendarCopyVariables[key].length);
        return (
            ui.variableReference(
                keys.map((key) => ({ label: fields[key][0], variables: app.state.calendarCopyVariables[key] })),
                variableLabels,
            ) +
            (unsupported.length
                ? '<p class="muted">不支持变量：' + esc(unsupported.map((key) => fields[key][0]).join("、")) + "</p>"
                : "")
        );
    }
    function render() {
        return (
            '<section><h2>日历文案</h2><p class="muted">共享文案修改后对所有使用方生效，条目末尾换行可分段</p>' +
            '<div class="grid"><label>分类<select id="calendarCopyCategory">' +
            ui.options(
                [
                    { id: "commands", name: "命令文案" },
                    { id: "today", name: "今日信息" },
                ],
                category,
            ) +
            '</select></label><label id="calendarCommandField"' +
            (category === "commands" ? "" : " hidden") +
            '>命令<select id="calendarCommand">' +
            ui.options(
                Object.entries(views)
                    .filter(([key]) => key !== "today")
                    .map(([id, item]) => ({ id, name: item.label })),
                command,
            ) +
            '</select></label></div><div class="markdown-workspace"><div class="markdown-editor">' +
            Object.entries(fields)
                .map(([key, [label, names]]) => {
                    const id = "calendar-copy-" + key;
                    return (
                        '<div id="calendar-copy-field-' +
                        key +
                        '"' +
                        (view().keys.includes(key) ? "" : " hidden") +
                        '><label for="' +
                        id +
                        '">' +
                        esc(label) +
                        "</label><small>用于 " +
                        uses(names) +
                        "</small>" +
                        '<textarea id="' +
                        id +
                        '">' +
                        esc(drafts[key] ?? app.config.calendarCopy[key]) +
                        "</textarea>" +
                        toolbar(id) +
                        "</div>"
                    );
                })
                .join("") +
            "</div>" +
            ui.previewPanel() +
            "</div>" +
            '<div id="calendarCopyVariables">' +
            variables() +
            '</div><div class="actions">' +
            btn("保存全部修改", "save-calendar-copy", "", "primary") +
            btn("恢复当前默认", "reset-calendar-copy") +
            '</div></section><section><h2>实际预览</h2><p id="calendarPreviewTarget">' +
            esc(view().label) +
            "</p>" +
            btn("预览", "preview-calendar") +
            '<p id="calendarPreviewHint" class="muted">使用当前文案和日历数据，不发送消息</p>' +
            '<div id="calendarPreviewResults" hidden><div id="calendarVariablePanel"><h3>变量输出</h3><code id="calendarPreviewVariable"></code><p id="calendarEmptyHint" class="muted" hidden>当前变量输出为空</p><div id="calendarPreview" class="message-preview" hidden></div></div>' +
            '<div id="calendarCommandPanel" hidden><h3 id="calendarCommandTitle">命令回复</h3><div id="calendarCommandPreview" class="message-preview" hidden></div></div></div></section>'
        );
    }
    function candidate() {
        const config = structuredClone(app.config);
        Object.assign(config.calendarCopy, drafts);
        return config;
    }
    async function action(a) {
        if (a === "save-calendar-copy") {
            app.config = candidate();

            try {
                await app.save();
            } catch (error) {
                app.render();
                throw error;
            }

            drafts = {};
            app.render();
            return;
        }

        if (a === "reset-calendar-copy") {
            const names = [...new Set(view().keys.flatMap((key) => fields[key][1]))];

            if (!(await app.confirmAction("恢复当前显示的文案？涉及 " + names.join("、") + "，保存后生效"))) {
                return;
            }

            for (const key of view().keys) {
                drafts[key] = app.state.calendarDefaults[key];
            }

            app.dirty = true;
            app.render();
            app.status("当前文案已恢复默认，保存后生效");
            return;
        }

        if (a === "preview-calendar") {
            invalidate("正在预览…");

            try {
                const subject = category === "commands" ? command : "today";
                const result = await app.api("copy-preview", { config: candidate(), subject });
                $("calendarPreviewResults").hidden = false;
                $("calendarPreviewHint").hidden = true;
                $("calendarVariablePanel").hidden = result.text === undefined;
                $("calendarPreviewVariable").textContent = result.variable ? "{{" + result.variable + "}}" : "";
                $("calendarPreview").hidden = !result.text;
                $("calendarEmptyHint").hidden = !!result.text;

                if (result.text) {
                    showMessage("calendarPreview", { text: result.text });
                }

                $("calendarCommandPanel").hidden = result.command === undefined;

                if (result.command !== undefined) {
                    $("calendarCommandTitle").textContent = "命令回复 · " + result.commandName;
                    showMessage("calendarCommandPreview", { text: result.command });
                }
            } catch (error) {
                invalidate("预览失败，请重试");
                throw error;
            }
        }
    }
    function invalidate(text = "内容已变化，请重新预览") {
        $("calendarPreviewResults").hidden = true;
        $("calendarPreviewHint").hidden = false;
        $("calendarPreviewHint").textContent = text;
    }
    function change(el) {
        if (el.id !== "calendarCopyCategory" && el.id !== "calendarCommand") {
            return;
        }

        category = $("calendarCopyCategory").value;
        command = $("calendarCommand").value;
        $("calendarCommandField").hidden = category !== "commands";

        for (const key of Object.keys(fields)) {
            $("calendar-copy-field-" + key).hidden = !view().keys.includes(key);
        }

        $("calendarCopyVariables").innerHTML = variables();
        $("calendarPreviewTarget").textContent = view().label;
        invalidate();
    }
    return {
        render,
        action,
        change,
        reset: () => {
            drafts = {};
        },
        transientInputs: ["calendarCopyCategory", "calendarCommand"],
        input: (el) => {
            if (el.id.startsWith("calendar-copy-")) {
                drafts[el.id.slice("calendar-copy-".length)] = el.value;
                invalidate();
            }
        },
    };
}
`;
