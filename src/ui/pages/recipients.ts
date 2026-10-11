export const recipientsPage = String.raw`
function createRecipientsPage(app, ui) {
    const { $, esc, uid, field, check, btn, table, put } = ui;
    let editingRecipient;

    function render() {
        let html = "";

        html +=
            '<section><h2>发送对象</h2><p class="muted">在目标群聊或私聊中发送官方 /sid，复制会话 ID 填入 OpenID。OpenID 与机器人绑定，不能用 QQ 号码替代。</p>' +
            btn("新增对象", "new-recipient", "", "primary");
        html +=
            table(
                ["名称", "场景 / ID", "状态", "操作"],
                app.config.recipients.map(
                    (r) =>
                        "<tr><td>" +
                        esc(r.name) +
                        "</td><td>" +
                        esc(r.scene) +
                        " · " +
                        esc(r.openid) +
                        "</td><td>" +
                        (r.enabled ? "启用" : "禁用") +
                        "</td><td>" +
                        btn("编辑", "edit-recipient", r.id) +
                        btn(r.enabled ? "禁用" : "启用", "toggle-recipient", r.id) +
                        btn("删除", "delete-recipient", r.id) +
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
                check("启用", "recipientEnabled", r.enabled) +
                "</div>" +
                btn("保存对象", "save-recipient", "", "primary") +
                "</section>";
        }

        return html;
    }
    async function action(a, id) {
        if (a === "new-recipient") {
            editingRecipient = {
                ...structuredClone(app.state.draftDefaults.recipient),
                id: uid(),
                scene: "group",
                openid: "",
                enabled: false,
                botId: app.state.currentBotId,
            };
            app.render();
            return;
        }

        if (a === "edit-recipient") {
            editingRecipient = structuredClone(app.config.recipients.find((r) => r.id === id));
            app.render();
            return;
        }

        if (a === "save-recipient") {
            put(app.config.recipients, {
                ...editingRecipient,
                name: $("recipientName").value,
                scene: $("scene").value,
                openid: $("openid").value.trim(),
                enabled: $("recipientEnabled").checked,
            });
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
            return;
        }
    }
    function reset() {
        editingRecipient = null;
    }

    return { render, action, reset };
}
`;
