export const checkinPage = String.raw`
function createCheckinSettings(app, ui) {
    const editor = createSettingsEditor(app, ui), render = editor.render, action = editor.action;
    let message = '';
    editor.render = () => render() + '<section><h2>积分接入</h2>' +
        '<p>领取积分需接入 Points、启用来源 daily，并由用户本人私聊开户</p>' +
        '<p>未接入积分时正常签到，奖励为 0；已完成的签到不补发积分</p>' +
        '<div class="actions">' + ui.btn('接入 / 检查积分', 'connect-checkin', '', 'primary') + '</div>' +
        '<p role="status">' + ui.esc(message) + '</p></section>';
    editor.action = async (a) => {
        if (a !== 'connect-checkin') { return action(a); }

        try { message = (await app.api('connect', {})).message; } catch (error) { message = error.message; }

        app.render();
    };
    return editor;
}
`;
