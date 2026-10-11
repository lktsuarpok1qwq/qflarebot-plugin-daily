export const recipientsPage = String.raw`
function createRecipientsPage(app, ui) {
    const { $, esc, uid, field, check, btn, table, put, mergeDraft } = ui;
    let editingRecipient, originalRecipient;

    function render() {
        let html = "";

        html +=
            '<section><h2>通知对象</h2><p class="muted">在目标会话发送 <strong>/sid</strong>，将会话 ID 填入 OpenID；不能填写 QQ 号码</p><p class="muted">命令使用范围在 QFlareBot 插件设置中配置</p>' +
            btn("新增对象", "new-recipient", "", "primary");
        html +=
            table(
                ["名称", "场景 / ID", "定时通知", "操作"],
                app.config.recipients.map(
                    (r) =>
                        "<tr><td>" +
                        esc(r.name) +
                        "</td><td>" +
                        (r.scene === "group" ? "群聊" : "私聊") +
                        " · " +
                        esc(r.openid) +
                        "</td><td>" +
                        (r.enabled ? "接收" : "不接收") +
                        "</td><td>" +
                        btn("编辑", "edit-recipient", r.id) +
                        btn(r.enabled ? "停止接收" : "接收定时通知", "toggle-recipient", r.id) +
                        btn("删除", "delete-recipient", r.id, "danger") +
                        "</td></tr>",
                ),
            ) + "</section>";

        if (editingRecipient) {
            const r = editingRecipient,
                existing = app.state.config.recipients.some((x) => x.id === r.id);
            html +=
                '<section><h2>对象配置</h2><div class="grid">' +
                field("名称", "recipientName", r.name) +
                '<label>场景<select id="scene" ' +
                (existing ? "data-locked disabled" : "") +
                '><option value="group">群聊</option><option value="c2c" ' +
                (r.scene === "c2c" ? "selected" : "") +
                ">私聊</option></select></label>" +
                field("OpenID", "openid", r.openid, "text", existing) +
                check("接收定时通知", "recipientEnabled", r.enabled) +
                "</div>" +
                btn("保存对象", "save-recipient", "", "primary") +
                btn("取消", "cancel-recipient") +
                "</section>";
        }

        return html;
    }
    async function action(a, id) {
        if (a === "new-recipient") {
            originalRecipient = undefined;
            editingRecipient = {
                ...structuredClone(app.state.draftDefaults.recipient),
                id: uid(),
                scene: "group",
                openid: "",
                enabled: false,
                botId: app.state.currentBotId,
            };
            app.render();
            app.focus("recipientName");
            return;
        }

        if (a === "edit-recipient") {
            editingRecipient = structuredClone(app.config.recipients.find((r) => r.id === id));
            originalRecipient = structuredClone(editingRecipient);
            app.render();
            app.focus("recipientName");
            return;
        }

        if (a === "cancel-recipient") {
            app.config = structuredClone(app.state.config);
            app.dirty = false;
            editingRecipient = null;
            app.render();
            app.focus("app");
            return;
        }

        if (a === "save-recipient") {
            put(app.config.recipients, mergeDraft(app.config.recipients.find((r) => r.id === editingRecipient.id), originalRecipient, {
                ...editingRecipient,
                name: $("recipientName").value,
                scene: $("scene").value,
                openid: $("openid").value.trim(),
                enabled: $("recipientEnabled").checked,
            }));
            await app.save();
            editingRecipient = null;
            app.render();
            return;
        }

        if (a === "toggle-recipient") {
            const r = app.config.recipients.find((r) => r.id === id);
            r.enabled = !r.enabled;
            await app.save();
            return;
        }

        if (a === "delete-recipient") {
            if (!(await app.confirmAction("删除对象及其全部绑定？"))) {
                return;
            }

            app.config.recipients = app.config.recipients.filter((r) => r.id !== id);
            app.config.bindings = app.config.bindings.filter((b) => b.recipientId !== id);
            await app.save();

            if (editingRecipient?.id === id) {
                editingRecipient = null;
            }

            app.render();
            return;
        }
    }
    function reset() {
        editingRecipient = null;
    }

    return { render, action, reset };
}
`;
