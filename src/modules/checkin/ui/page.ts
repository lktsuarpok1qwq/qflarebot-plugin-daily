export const checkinPage = String.raw`
function createCheckinSettings(app, ui) {
    const editor = createSettingsEditor(app, ui), render = editor.render, action = editor.action, input = editor.input;
    editor.render = () => render().replace('<div class="actions">', '<p id="checkinRewardRule" class="muted" role="status"></p><div class="actions">') + '<section><h2>积分接入</h2>' +
        '<p>领取积分需接入 Points、启用来源 daily，并由用户本人私聊开户</p>' +
        '<p>未接入积分或未开户也可签到、计入群榜；当天不补发积分</p>' +
        '<div class="actions">' + ui.btn('接入 / 检查积分', 'connect-checkin', '', 'primary') + '</div>' +
        '</section>';
    editor.refresh = () => {
        const hint = ui.$('checkinRewardRule');

        if (!hint) { return; }

        const ids = ['checkinReward', 'checkinStreak', 'checkinMultiplier'], fields = ids.map(id => ui.$(id));

        if (fields.some(field => !field.validity.valid)) {
            hint.textContent = '填写有效参数后显示奖励规则';

            return;
        }

        const [base, threshold, multiplier] = fields.map(field => Number(field.value)), bonus = Math.round(base * 100) * multiplier;
        hint.textContent = bonus > 1000000000000 ? '加成奖励超过积分单笔上限' : '连续第 ' + (threshold + 1) + ' 天起，每天 ' + (bonus / 100) + ' 积分';
    };
    editor.input = el => {
        input(el);
        editor.refresh();
    };
    editor.change = editor.input;
    editor.action = async (a) => {
        if (a === 'save-checkin-settings' && Math.round(Number(ui.$('checkinReward').value) * 100) * Number(ui.$('checkinMultiplier').value) > 1000000000000) {
            ui.fieldError('checkinReward', '加成后的奖励超过积分单笔上限');
            app.focus('checkinReward');

            return;
        }

        if (a !== 'connect-checkin') { return action(a); }

        const result = await app.api('connect', {});
        app.status(result.message);
    };

    return editor;
}

function createCheckinCopyEditor(app, ui) {
    return createCopyEditor(app, ui, app.id, {
        renderSample(sample, config, key, mark) {
            if (sample.id === 'mine' || sample.id === 'mineUnsigned') {
                const statusKey = sample.id === 'mine' ? 'todaySigned' : 'todayUnsigned';
                const status = config.copy[statusKey], fragment = key === statusKey ? mark(status) : status;
                const text = inlineCommandTools.expand(config.copy.mine, sample.values, { today_status: fragment });

                return [{ text: key === 'mine' ? mark(text) : text }];
            }

            if (sample.id !== 'ranking') { return [{ text: mark(inlineCommandTools.expand(config.copy[key], sample.values || {})) }]; }

            const separator = config.copy.rankingSeparator ?? '';
            const items = inlineCommandTools.join(['', '2', '3'].map(suffix => {
                const values = Object.fromEntries(['rank', 'name', 'total', 'streak'].map(name => [name, sample.values[name + suffix]]));
                const text = inlineCommandTools.expand(config.copy.rankingItem, values);

                return key === 'rankingItem' ? mark(text) : text;
            }), key === 'rankingSeparator' ? mark(separator) : separator);
            const body = inlineCommandTools.expand(config.copy.ranking, {}, { items });

            return [{ text: key === 'ranking' ? mark(body) : body }];
        },
    });
}
`;
