export const commandLinkPage = String.raw`
function createCommandLinkPage(app, ui) {
    const { $, esc, btn } = ui;
    let label = "", command = "", mode = "send";
    function result() {
        const text = command.trimStart();

        if (!text.trim()) {
            return "";
        }

        const full = text.startsWith("/") ? text : "/" + text;
        return "[" + inlineCommandTools.expand("{{label}}", { label: label.trim() || full.trim() }) + "](" +
            inlineCommandTools.url(full, mode === "send") + ")";
    }
    function render() {
        const value = result();
        return '<section><h2>命令链接</h2><p class="muted">生成后复制到回复或公告文案，中文和空格自动编码</p>' +
            '<div class="grid"><label for="inlineLabel">显示文字<input id="inlineLabel" value="' + esc(label) +
            '" placeholder="留空使用命令"></label><label for="inlineMode">点击行为<select id="inlineMode">' +
            ui.options([{ id: "send", name: "点击发送" }, { id: "input", name: "仅填入" }], mode) +
            '</select></label></div><label for="inlineCommand">命令内容<input id="inlineCommand" value="' + esc(command) +
            '" placeholder="/天气 北京" aria-describedby="inlineHint"></label>' +
            '<p id="inlineHint" class="muted">完整命令选点击发送，需要补参数选仅填入；省略 / 会自动补上，末尾空格保留</p>' +
            '<label for="inlineResult">Markdown 链接<textarea id="inlineResult" rows="4" readonly spellcheck="false">' + esc(value) +
            '</textarea></label><div class="actions"><button id="inlineCopy" data-action="copy-inline-link" class="primary"' +
            (value ? "" : " disabled data-locked") + '>复制链接</button>' + btn("清空", "clear-inline-link") +
            '</div><p class="muted">仅在本地生成，不发送消息；点击效果以 QQ 客户端为准</p></section>';
    }
    function update(el) {
        if (el.id === "inlineLabel") {
            label = el.value;
        } else if (el.id === "inlineCommand") {
            command = el.value;
        } else if (el.id === "inlineMode") {
            mode = el.value;
        } else {
            return;
        }

        const value = result();
        $("inlineResult").value = value;
        $("inlineCopy").disabled = !value;
        $("inlineCopy").toggleAttribute("data-locked", !value);
    }
    async function action(a) {
        if (a === "clear-inline-link") {
            label = command = "";
            mode = "send";
            app.render();
            app.focus("inlineCommand");
            return;
        }

        if (a !== "copy-inline-link" || !result()) {
            return;
        }

        try {
            await navigator.clipboard.writeText(result());
            app.status("已复制 Markdown 链接");
        } catch {
            const output = $("inlineResult");
            output.disabled = false;
            output.focus();
            output.select();
            let copied = false;

            try {
                copied = document.execCommand("copy");
            } catch {
                // The sandbox may deny clipboard access; keep the text selected for manual copying.
            }

            app.focus("inlineResult");
            app.status(copied ? "已复制 Markdown 链接" : "已选中链接，请手动复制");
        }
    }
    return {
        render, action, input: update, change: update,
        transientInputs: ["inlineLabel", "inlineCommand", "inlineMode", "inlineResult"],
    };
}
`;
