export const commandCopyPage = String.raw`
function createCommandCopy(app, ui, description, feedback = false) {
    const { $, esc, btn, showMessage, toolbar } = ui;
    let selectedCommand,
        drafts = {};
    const replyLabels = {
        body: "完整回复",
    };
    const feedbackLabels = { error: "命令处理失败", tooLong: "消息过长" };
    function render() {
        let html = "";
        const names = feedback ? Object.keys(feedbackLabels) : app.state.commandNames;
        selectedCommand ||= names[0];
        const reply = {
            ...(feedback ? { body: app.config.commandFeedback[selectedCommand] } : app.config.replies[selectedCommand]),
            ...drafts[selectedCommand],
        };
        html +=
            "<section><h2>" +
            (feedback ? "通用提示" : "命令回复") +
            "</h2>" +
            description +
            "<label>" +
            (feedback ? "提示" : "命令") +
            '<select id="commandName">' +
            names
                .map(
                    (name) =>
                        '<option value="' +
                        esc(name) +
                        '" ' +
                        (name === selectedCommand ? "selected" : "") +
                        ">" +
                        (feedback ? feedbackLabels[name] : "/" + esc(name)) +
                        "</option>",
                )
                .join("") +
            '</select></label><div class="markdown-workspace"><div class="markdown-editor">';

        for (const [key, label] of Object.entries(replyLabels)) {
            if (!Object.hasOwn(reply, key)) {
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
            "</div>" +
            ui.previewPanel() +
            "</div>" +
            ui.variableReference(
                Object.entries(replyLabels)
                    .filter(([key]) => Object.hasOwn(reply, key))
                    .map(([key, label]) => ({
                        label,
                        variables: feedback ? ["year", "today"] : app.state.replyVariables[selectedCommand][key],
                    })),
                { year: "当前年份", today: "今天日期", commands: "模块一级命令链接，点击发送" },
            ) +
            '<p class="muted">实际预览会替换变量，不发送消息</p>' +
            btn("保存全部修改", "save-copy", "", "primary") +
            btn("恢复当前默认", "reset-reply") +
            btn("实际预览", "preview-reply") +
            '<h3>回复预览</h3><p id="replyPreviewHint" class="muted">点击“实际预览”查看结果</p><div id="replyPreview" class="message-preview" hidden></div></section>';
        return html;
    }
    function candidate() {
        const config = structuredClone(app.config);

        for (const [name, fields] of Object.entries(drafts)) {
            if (feedback) {
                config.commandFeedback[name] = fields.body;
            } else {
                Object.assign(config.replies[name], fields);
            }
        }

        return config;
    }
    async function action(a) {
        if (a === "save-copy") {
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

        if (a === "reset-reply") {
            if (!(await app.confirmAction("恢复当前文案？保存后生效"))) {
                return;
            }

            drafts[selectedCommand] = structuredClone(
                feedback
                    ? { body: app.state.commandFeedbackDefaults[selectedCommand] }
                    : app.state.replyDefaults[selectedCommand],
            );
            app.dirty = true;
            app.render();
            app.status("当前文案已恢复默认，保存后生效");
            return;
        }

        if (a === "preview-reply") {
            $("replyPreview").hidden = true;
            $("replyPreviewHint").hidden = false;
            $("replyPreviewHint").textContent = "正在生成预览…";

            try {
                showMessage(
                    "replyPreview",
                    await app.api("command-preview", { config: candidate(), command: selectedCommand, feedback }),
                );
                $("replyPreviewHint").hidden = true;
            } catch (error) {
                $("replyPreviewHint").textContent = "预览失败，请修改后重试";
                throw error;
            }

            return;
        }
    }
    function change(el) {
        if (el.id === "commandName") {
            selectedCommand = el.value;
            app.render();
        }
    }
    function input(el) {
        if (el.id.startsWith("reply-")) {
            (drafts[selectedCommand] ||= {})[el.id.slice(6)] = el.value;
            $("replyPreview").hidden = true;
            $("replyPreviewHint").hidden = false;
            $("replyPreviewHint").textContent = "文案已修改，请重新预览";
        }
    }
    return {
        render,
        action,
        change,
        input,
        reset: () => {
            drafts = {};
        },
    };
}
`;
