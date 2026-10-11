export const sayingPage = String.raw`
function createSayingPage(app, ui) {
    const { $, esc, btn, toolbar, showMessage } = ui;
    let draft, target = "today";
    function render() {
        return '<section><h2>一言文案</h2><p>用于 <strong>/一言</strong> 和公告变量 <strong><code>{{一言.今日}}</code></strong>，修改后共同生效</p>' +
            '<p class="muted">命令每次随机查询，今日一言当天首次使用时获取并保存，获取失败时公告变量为空</p>' +
            '<div class="markdown-workspace"><div class="markdown-editor"><label for="sayingBody">输出文案</label><textarea id="sayingBody">' +
            esc(draft ?? app.config.copy.body) + '</textarea>' + toolbar("sayingBody") + '</div>' + ui.previewPanel() + '</div>' +
            '<div class="variable-reference"><h3>可用变量</h3><p><code>{{text}}</code> · ' + esc(app.state.fields.text) + '</p></div>' +
            '<div class="actions">' + btn("保存", "save-saying", "", "primary") + btn("恢复默认", "reset-saying") + btn("取消", "cancel-saying") + '</div></section>' +
            '<section><h2>实际预览</h2><label for="sayingTarget">预览内容</label><select id="sayingTarget">' +
            ui.options([{ id: "today", name: "变量输出 · {{一言.今日}}" }, { id: "command", name: "命令回复 · /一言" }], target) +
            '</select><p id="sayingPreviewHint" class="muted">手动获取内容，不发送消息；今日一言与公告共用当天内容</p>' +
            btn("预览", "preview-saying") + '<div id="sayingPreviewResult" hidden><h3 id="sayingPreviewTitle"></h3><div id="sayingPreview" class="message-preview"></div></div></section>';
    }
    function candidate() {
        const config = structuredClone(app.config);
        if (draft !== undefined) {
            config.copy.body = draft;
        }
        return config;
    }
    function invalidate() {
        $("sayingPreviewResult").hidden = true;
        $("sayingPreviewHint").textContent = "内容已变化，请重新预览";
    }
    async function action(a) {
        if (a === "save-saying") {
            app.config = candidate();
            try {
                await app.save();
            } catch (error) {
                app.render();
                throw error;
            }
            draft = undefined;
            app.render();
        } else if (a === "reset-saying") {
            if (!(await app.confirmAction("恢复一言文案？保存后生效"))) {
                return;
            }
            draft = app.state.defaults.body;
            app.dirty = true;
            app.render();
        } else if (a === "cancel-saying") {
            app.render();
        } else if (a === "preview-saying") {
            invalidate();
            try {
                const result = await app.api("preview", { config: candidate(), target });
                $("sayingPreviewTitle").textContent = target === "today" ? "变量输出 · {{一言.今日}}" : "命令回复 · /一言";
                showMessage("sayingPreview", result);
                $("sayingPreviewResult").hidden = false;
                $("sayingPreviewHint").textContent = "本次预览结果，不发送消息";
            } catch (error) {
                $("sayingPreviewHint").textContent = "预览失败，请重试";
                throw error;
            }
        }
    }
    return {
        render, action,
        input(el) {
            if (el.id === "sayingBody") {
                draft = el.value;
                invalidate();
            }
        },
        change(el) {
            if (el.id === "sayingTarget") {
                target = el.value;
                invalidate();
            }
        },
        discardActions: ["cancel-saying"],
        transientInputs: ["sayingTarget"],
        reset: () => { draft = undefined; },
    };
}
`;
