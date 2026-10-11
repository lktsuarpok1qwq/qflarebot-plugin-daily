export const statusPage = String.raw`
function createStatusPage(app, ui) {
    const { $, esc, time, options, btn, table } = ui;
    let backup,
        restoreRevision,
        logsOffset = 0;

    function render() {
        let html = "";

        html +=
            '<section><h2>运行控制</h2><div class="actions">' +
            btn(app.config.paused ? "解除全局暂停" : "全局紧急暂停", "pause", "", "danger") +
            btn("立即清理过期日志", "cleanup") +
            '</div><p>维护任务不追加插件运行日志；框架自身可能输出 Cron 完成信息。发送采用 SDK 预算预留，临近窗口结束会跳过。</p><div class="grid"><label>日志保留<select id="retention">' +
            [7, 30, 90]
                .map((v) => "<option " + (v === app.config.retentionDays ? "selected" : "") + ">" + v + "</option>")
                .join("") +
            "</select></label>" +
            "</div>" +
            btn("保存设置", "save-settings") +
            "<pre>" +
            esc(JSON.stringify(app.state.jobs, null, 2)) +
            '</pre><p class="muted">单轮最多 ' +
            app.state.limits.batch +
            " 个目标，并发 " +
            app.state.limits.concurrency +
            "；请尽量错开发送时间，超出容量或发送窗口的计划会跳过。</p></section>";
        html +=
            '<section><h2>执行日志</h2><div class="grid"><label>任务<select id="logTask"><option value="">全部</option>' +
            options(app.config.tasks) +
            '</select></label><label>目标<select id="logRecipient"><option value="">全部</option>' +
            options(app.config.recipients) +
            '</select></label><label>状态<select id="logStatus"><option value="">全部</option>' +
            [
                "success",
                "failed_api",
                "failed_validation",
                "uncertain",
                "skipped_empty",
                "skipped_expired",
                "skipped_budget",
                "skipped_disabled",
            ]
                .map((v) => "<option>" + v + "</option>")
                .join("") +
            "</select></label></div>" +
            btn("查询", "load-logs") +
            btn("上一页", "logs-prev") +
            btn("下一页", "logs-next") +
            '<div id="logs"></div></section>';
        html +=
            "<section><h2>备份与恢复</h2><p>恢复保留原启用状态，并从恢复完成后的未来时间重新排程。</p>" +
            btn("导出 JSON", "export-backup") +
            '<label>选择备份<input id="backupFile" type="file" accept=".json"></label><div class="actions">' +
            btn("预览恢复", "preview-restore") +
            btn("确认恢复", "restore", "", "danger") +
            '</div><pre id="backupPreview" hidden></pre></section>';

        return html;
    }
    async function action(a, id) {
        if (a === "pause") {
            app.config.paused = !app.config.paused;
            await app.save(app.config.paused ? "已暂停主动发送" : "已恢复，只执行未来计划");
            return;
        }

        if (a === "save-settings") {
            app.config.retentionDays = +$("retention").value;
            await app.save();
            return;
        }

        if (["load-logs", "logs-prev", "logs-next"].includes(a)) {
            logsOffset = a === "load-logs" ? 0 : Math.max(0, logsOffset + (a === "logs-next" ? 50 : -50));
            const qs = new URLSearchParams({
                    task: $("logTask").value,
                    recipient: $("logRecipient").value,
                    status: $("logStatus").value,
                    offset: String(logsOffset),
                }),
                logs = await app.api("logs?" + qs);
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
                        esc(l.status) +
                        "</td><td><details><summary>展开</summary><pre>" +
                        esc(JSON.stringify(l, null, 2)) +
                        "</pre></details></td></tr>",
                ),
            );
            return;
        }

        if (a === "export-backup") {
            const b = await app.api("backup"),
                url = URL.createObjectURL(
                    new Blob([JSON.stringify(b)], {
                        type: "application/json",
                    }),
                ),
                link = document.createElement("a");
            link.href = url;
            link.download = "daily-backup-" + new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10) + ".json";
            document.body.append(link);
            link.click();
            setTimeout(() => {
                URL.revokeObjectURL(url);
                link.remove();
            }, 1000);
            return;
        }

        if (a === "preview-restore") {
            if (!backup) {
                throw Error("请先选择备份");
            }

            const p = await app.api("restore-preview", { backup });
            restoreRevision = p.revision;
            $("backupPreview").hidden = false;
            $("backupPreview").textContent = JSON.stringify(p, null, 2);
            return;
        }

        if (a === "restore") {
            if (
                restoreRevision === undefined ||
                !(await app.confirmAction("使用预览的备份替换当前配置，并保留原启用状态？"))
            ) {
                return;
            }

            await app.api("restore", {
                backup,
                revision: restoreRevision,
                confirm: true,
            });
            restoreRevision = undefined;
            app.resetDrafts();
            await app.load();
            app.status("恢复完成，已重算未来计划");
            return;
        }
    }

    async function change(el) {
        if (el.id === "backupFile") {
            await app.run(async () => {
                backup = undefined;
                restoreRevision = undefined;
                const file = el.files?.[0];

                if (!file) {
                    return;
                }

                if (file.size > app.state.limits.backupBytes) {
                    throw Error("备份文件过大");
                }

                backup = JSON.parse(await file.text());
                app.status("备份已读取，请预览");
            });
        }
    }

    return { render, action, change };
}
`;
