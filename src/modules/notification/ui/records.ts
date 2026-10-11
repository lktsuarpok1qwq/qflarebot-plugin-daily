export const recordsPage = String.raw`
function createNotificationRecords(app, ui) {
    const { $, esc, time, options, btn, table } = ui;
    const settings = createSettingsEditor(app, ui);
    const statusLabels = {
        sending: "发送中",
        success: "发送成功",
        failed_api: "平台拒绝",
        failed_validation: "内容无效",
        uncertain: "结果不确定",
        skipped_empty: "空内容跳过",
        skipped_expired: "已过期",
        skipped_budget: "超出发送预算",
        skipped_disabled: "已停用",
    };
    let logCursors = [null], logPage = 0, logNext = null, logFilter = "";

    function render() {
        let html = "";

        html +=
            '<section><h2>运行控制</h2><div class="actions">' +
            btn(app.config.paused ? "恢复通知" : "暂停通知", "pause", "", "danger") +
            btn("立即清理过期日志", "cleanup") +
            '</div><p>暂停只停止发送，查询和维护照常运行；过期计划跳过</p>' +
            '<details id="maintenanceDetails"><summary>维护任务详情</summary><pre>' +
            esc(JSON.stringify(app.state.jobs, null, 2)) +
            '</pre></details><p class="muted">同一时间发送过多，可能无法全部完成，建议错开时间</p></section>';
        html += settings.render();
        html +=
            '<section><h2>执行日志</h2><div class="grid"><label>任务<select id="logTask"><option value="">全部</option>' +
            options(app.config.tasks) +
            '</select></label><label>目标<select id="logRecipient"><option value="">全部</option>' +
            options(app.config.recipients) +
            '</select></label><label>状态<select id="logStatus"><option value="">全部</option>' +
            Object.entries(statusLabels)
                .map(([value, label]) => '<option value="' + value + '">' + label + "</option>")
                .join("") +
            "</select></label></div>" +
            btn("查询", "load-logs") +
            btn("上一页", "logs-prev") +
            btn("下一页", "logs-next") +
            '<div id="logs"><p class="muted">选择条件后查询发送记录</p></div></section>';

        return html;
    }
    async function action(a) {
        if (a === "cleanup") {
            const result = await app.api("maintenance", { job: "cleanup" });
            await app.load();
            app.status(result.message, !result.ok);
            return;
        }

        if (a === "pause") {
            app.config.paused = !app.config.paused;
            await app.save(app.config.paused ? "已暂停通知" : "已恢复，只执行未来计划");
            return;
        }

        if (["load-logs", "logs-prev", "logs-next"].includes(a)) {
            const filters = { task: $("logTask").value, recipient: $("logRecipient").value, status: $("logStatus").value };
            const key = JSON.stringify(filters);
            const restart = a === "load-logs" || key !== logFilter;
            const cursors = restart ? [null] : logCursors.slice();
            let index = restart ? 0 : logPage;

            if (!restart && a === "logs-next") {
                if (!logNext) { return; }

                cursors[++index] = logNext;
            } else if (!restart && a === "logs-prev") {
                index = Math.max(0, index - 1);
            }

            const qs = new URLSearchParams(filters);

            if (cursors[index]) { qs.set("before", cursors[index]); }

            const result = await app.api("logs?" + qs), logs = result.items;
            logCursors = cursors;
            logPage = index;
            logNext = result.next;
            logFilter = key;
            $("logs").innerHTML = table(
                ["计划时间", "任务 / 目标", "状态", "详情"],
                logs.map(
                    (l) =>
                        "<tr><td>" +
                        time(l.due_at) +
                        "</td><td>" +
                        esc(app.config.tasks.find((t) => t.id === l.task_id)?.name || l.task_id) +
                        " / " +
                        esc(app.config.recipients.find((r) => r.id === l.recipient_id)?.name || l.recipient_id) +
                        "</td><td>" +
                        esc(statusLabels[l.status] || l.status) +
                        "</td><td><details><summary>展开</summary><pre>" +
                        esc(JSON.stringify(l, null, 2)) +
                        "</pre></details></td></tr>",
                ),
            );
            return;
        }

        await settings.action(a);

    }
    function reset() { logCursors = [null]; logPage = 0; logNext = null; logFilter = ""; settings.reset(); }
    return { render, action, reset, input: settings.input, change: settings.change, transientInputs: ["logTask", "logRecipient", "logStatus"], get discardActions() { return ["pause", "cleanup", ...settings.discardActions]; } };
}
`;
