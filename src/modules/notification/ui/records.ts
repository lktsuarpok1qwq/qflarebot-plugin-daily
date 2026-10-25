export const recordsPage = String.raw`
function createNotificationRecords(app, ui) {
    const { $, esc, time, options, btn, table } = ui;
    const settings = createSettingsEditor(app, ui);
    const jobs = createLazySection(app, ui, "jobs", "维护详情", {
        render: () => '<pre>' + esc(JSON.stringify(app.state.jobs, null, 2)) + '</pre>',
    });
    const statusLabels = notificationStatuses;
    let logCursors = [null], logPage = 0, logNext = null, logFilter = "";
    const details = new Map();
    let logItems = null;
    let filters = { task: '', recipient: '', status: '', days: '7' }, logRange = null, logVersion = 0;

    function renderLogs(items) {
        return table(
            ["计划时间", "任务 / 目标", "状态", "详情"],
            items.map(
                (l) =>
                    "<tr><td>" +
                    time(l.due_at) +
                    "</td><td>" +
                    esc(app.config.tasks.find((t) => t.id === l.task_id)?.name || l.task_id) +
                    " / " +
                    esc(app.config.recipients.find((r) => r.id === l.recipient_id)?.name || l.recipient_id) +
                    "</td><td>" +
                    esc(statusLabels[l.status] || l.status) +
                    "</td><td>" + btn("展开", "log-detail", l.key) + "<pre hidden></pre></td></tr>",
            ),
        );
    }

    function render() {
        let html = "";

        html +=
            '<section><h2>运行控制</h2><div class="actions">' +
            btn(app.config.paused ? "恢复通知" : "暂停通知", "pause", "", "danger") +
            btn("立即清理过期日志", "cleanup") +
            '</div><p>暂停只停止发送，查询和维护照常运行；过期计划跳过</p><details id="maintenanceDetails"><summary>维护任务详情</summary>' + jobs.render() + '</details>' +
            '<p class="muted">同一时间发送过多，可能无法全部完成，建议错开时间</p></section>';
        html += settings.render();
        html +=
            '<section><h2>执行日志</h2><p class="muted">按创建时间倒序</p><div class="grid"><label>任务<select id="logTask"><option value="">全部</option>' +
            options(app.config.tasks, filters.task) +
            '</select></label><label>目标<select id="logRecipient"><option value="">全部</option>' +
            options(app.config.recipients, filters.recipient) +
            '</select></label><label>状态<select id="logStatus"><option value="">全部</option>' +
            Object.entries(statusLabels)
                .map(([value, label]) => '<option value="' + value + '"' + (filters.status === value ? ' selected' : '') + '>' + label + "</option>")
                .join("") +
            '</select></label><label>时间范围<select id="logDays">' + options([{ id: '1', name: '今天' }, { id: '7', name: '最近 7 天' }, { id: '30', name: '最近 30 天' }, { id: '90', name: '最近 90 天' }, { id: '0', name: '全部记录' }], filters.days) + '</select></label></div>' +
            '<div class="actions">' + btn("查询", "load-logs") + '</div>' +
            '<div id="logs">' + (logItems ? renderLogs(logItems) : '<p class="muted">选择条件后查询发送记录</p>') + '</div>' +
            '<div class="actions">' + btn("上一页", "logs-prev") + btn("下一页", "logs-next") +
            '<span class="muted" id="log-page">第 ' + (logPage + 1) + ' 页</span></div></section>';

        return html;
    }

    async function action(a, id) {
        await jobs.action(a, id);

        if (a === "log-detail") {
            const key = id;
            const button = [...document.querySelectorAll('[data-action="log-detail"]')].find((el) => el.dataset.id === key);
            const output = button?.parentElement.querySelector('pre');

            if (!output) { return; }

            if (!output.hidden && details.has(key)) {
                output.hidden = true;
                button.textContent = '展开';

                return;
            }

            output.hidden = false;
            output.textContent = '正在加载…';

            try {
                if (!details.has(key)) {
                    const result = await app.api('log?key=' + encodeURIComponent(key));

                    if (!result || !Object.hasOwn(result, 'record')) { throw Error('记录响应格式错误，请重新查询'); }

                    details.set(key, result.record === null ? null : checkNotificationRecord(result.record, key));
                }

                const record = details.get(key);
                output.textContent = record ? JSON.stringify(record, null, 2) : '记录已清理';
                button.textContent = '收起';
            } catch (error) {
                output.textContent = error.message;
                button.textContent = '重试';
            }

            return;
        }

        if (a === "cleanup") {
            let result;

            try { result = await app.api("maintenance", { job: "cleanup" }); } finally {
                reset();
                app.state.jobs = null;
                app.render();
            }

            if (!result || typeof result.ok !== 'boolean' || typeof result.message !== 'string') { throw Error('清理结果未确认，请重新查询记录'); }

            app.status(result.message, !result.ok);

            return;
        }

        if (a === "pause") {
            app.config.paused = !app.config.paused;
            await app.save(app.config.paused ? "已暂停通知" : "已恢复，只执行未来计划");

            return;
        }

        if (["load-logs", "logs-prev", "logs-next"].includes(a)) {
            filters = { task: $("logTask").value, recipient: $("logRecipient").value, status: $("logStatus").value, days: $("logDays").value };
            const key = JSON.stringify(filters);
            const restart = a === "load-logs" || key !== logFilter;
            const cursors = restart ? [null] : logCursors.slice();
            let index = restart ? 0 : logPage;

            if (restart) {
                logCursors = [null];
                logPage = 0;
                logNext = null;
                logItems = null;
                logRange = null;
                details.clear();
                $('log-page').textContent = '第 1 页';
                $('logs').innerHTML = '<p class="muted">正在查询…</p>';
                refresh();
            }

            if (!restart && a === "logs-next") {
                if (!logNext) { return; }

                cursors[++index] = logNext;
            } else if (!restart && a === "logs-prev") {
                index = Math.max(0, index - 1);
            }

            const qs = new URLSearchParams(filters);

            if (cursors[index]) { qs.set("before", cursors[index]); }

            const state = app.state, version = ++logVersion;

            if (!restart && logRange) {
                qs.set('from', String(logRange.from));
                qs.set('to', String(logRange.to));
            }

            let result;

            try {
                result = await app.api("logs?" + qs);

                if (!result || !Array.isArray(result.items) || result.next !== null && typeof result.next !== 'string'
                    || !result.range || !Number.isSafeInteger(result.range.from) || !Number.isSafeInteger(result.range.to) || result.range.from < 0 || result.range.to <= result.range.from
                    || !restart && logRange && (result.range.from !== logRange.from || result.range.to !== logRange.to)) { throw Error('记录响应格式错误，请重新查询'); }

                result.items.forEach(row => checkNotificationRecord(row));
            } catch (error) {
                if (restart && version === logVersion && state === app.state && key === JSON.stringify(filters)) { $('logs').textContent = '查询失败，请重新查询'; }

                throw error;
            }

            const logs = result.items;

            if (version !== logVersion || state !== app.state || key !== JSON.stringify(filters)) { return; }

            details.clear();
            logCursors = cursors;
            logPage = index;
            logNext = result.next;
            logFilter = key;
            logRange = result.range;
            $('log-page').textContent = '第 ' + (logPage + 1) + ' 页';
            logItems = logs;
            $('logs').innerHTML = renderLogs(logItems);

            refresh();
            app.refresh();

            return;
        }

        await settings.action(a);
    }

    function refresh() {
        for (const [action, disabled] of [['logs-prev', logPage === 0], ['logs-next', !logNext]]) {
            const button = document.querySelector('[data-action="' + action + '"]');
            button?.toggleAttribute('data-locked', disabled);
            button?.setAttribute('data-managed-disabled', '');
        }

        const details = $("maintenanceDetails");

        if (!details) { return; }

        details.ontoggle = () => { if (details.open) { jobs.refresh(); } };

        if (details.open) { jobs.refresh(); }
    }

    function reset(invalidate = true) {
        if (invalidate) {
            logCursors = [null];
            logPage = 0;
            logNext = null;
            logFilter = '';
            logItems = null;
            filters = { task: '', recipient: '', status: '', days: '7' };
            logRange = null;
            logVersion++;
            details.clear();
        }

        settings.reset();
    }

    function input(el) {
        const key = { logTask: 'task', logRecipient: 'recipient', logStatus: 'status', logDays: 'days' }[el.id];

        if (!key) { return settings.input(el); }

        if (filters[key] === el.value) { return; }

        filters[key] = el.value;
        logRange = null;
        logVersion++;
        logItems = null;
        logCursors = [null];
        logPage = 0;
        logNext = null;
        details.clear();
        $('logs').innerHTML = '<p class="muted">条件已修改，请重新查询</p>';
        $('log-page').textContent = '第 1 页';
        refresh();
    }

    return { render, action, reset, refresh, isDirty: settings.isDirty, input, change: input, transientInputs: ["logTask", "logRecipient", "logStatus", "logDays"], get discardActions() { return ["pause", "cleanup", ...settings.discardActions]; } };
}
`;
