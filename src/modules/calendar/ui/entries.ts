export const calendarEntries = String.raw`
function createCalendarEntries(app, ui) {
    const { $, esc, uid, time, options, field, btn, table, put, check, mergeDraft } = ui;
    let editingEvent, originalEvent, imported, importText = "";

    function render() {
        let html = "";

        html +=
            '<section><h2>年度数据</h2><p class="muted">同步当年和明年数据，保留人工修改</p><details id="syncHelp"><summary>更新频率与数据说明</summary><p class="muted">未公布放假安排时仅记录节日日期<br>00:00 检查当年，00:01 检查明年<br>当年已有安排或明年七个节日安排齐全时每 7 天同步，其余每天同步<br>失败次日重试，立即同步不受间隔限制<br>00:10 清理往年已结束的条目</p></details>' +
            btn("立即同步", "sync", "", "primary") +
            table(
                ["年份", "数据变更时间", "最近检查成功", "获取频率", "状态", "来源"],
                app.state.sources.map(
                    (s) =>
                        "<tr><td>" +
                        s.year +
                        "</td><td>" +
                        (s.updated_at && (s.hasData || s.references) ? time(s.updated_at) : "暂无数据") +
                        "</td><td>" +
                        (s.checked_at ? time(s.checked_at) : "尚未检查") +
                        "</td><td>" +
                        (s.refreshDays === 7 ? "每 7 天" : "每天") +
                        "</td><td>" +
                        esc(
                            s.error === "not_published"
                                ? "接口暂未提供安排"
                                : s.error ||
                                (s.hasData ? "已有放假与调休安排" : "放假安排待公布") +
                                (s.references ? "；" + s.references + " 个节日仅有日期" : ""),
                        ) +
                        '</td><td><a target="_blank" rel="noopener noreferrer" href="' +
                        "https://uapis.cn/docs/api-reference/get-misc-holiday-calendar" +
                        '">查看来源</a></td></tr>',
                ),
            ) +
            "<details><summary>日历维护详情</summary><pre>" +
            esc(JSON.stringify(app.state.jobs, null, 2)) +
            "</pre></details></section>";
        html +=
            '<section><h2>日历条目</h2><p class="muted">停用条目不参与查询和通知，数据保留</p>' +
            btn("新增事件", "new-event", "", "primary") +
            table(
                ["名称", "日期", "类别", "来源 / 状态", "操作"],
                app.config.events.map(
                    (h) =>
                        "<tr><td>" +
                        esc(h.name) +
                        "</td><td>" +
                        esc(
                            h.repeat === "yearly"
                                ? "每年 " + h.start.slice(5) + "（从 " + h.start.slice(0, 4) + " 年起）"
                                : h.kind === "holiday"
                                    ? h.start + " 至 " + h.end
                                    : h.start,
                        ) +
                        "</td><td>" +
                        (h.kind === "holiday"
                            ? "放假"
                            : h.kind === "makeup"
                                ? "调休上班"
                                : h.kind === "event"
                                    ? "节日"
                                    : "节日日期（放假安排待公布）") +
                        "</td><td>" +
                        (h.source === "manual" ? "人工" : "UAPI") +
                        " · " +
                        (h.enabled ? "启用" : "已停用") +
                        "</td><td>" +
                        btn("编辑", "edit-event", h.id) +
                        btn(h.enabled ? "停用" : "启用", "toggle-event", h.id) +
                        (h.source === "manual" && /^uapi-(?:holiday|makeup|reference)-\d{4}-/.test(h.id)
                            ? btn("恢复默认", "reset-event", h.id)
                            : "") +
                        btn("删除", "delete-event", h.id, "danger") +
                        "</td></tr>",
                ),
            ) +
            "</section>";

        if (editingEvent) {
            const h = editingEvent;
            html +=
                '<section><h2>编辑日历事件</h2><div class="grid">' +
                field("名称", "eventName", h.name) +
                field("日期 / 放假开始", "eventStart", h.start, "date") +
                '<div id="eventEndField"' +
                (h.kind === "holiday" ? "" : " hidden") +
                ">" +
                field("放假结束", "eventEnd", h.end, "date") +
                "</div>" +
                '<label>类别<select id="eventKind">' +
                options(
                    [
                        { id: "holiday", name: "放假" },
                        { id: "makeup", name: "调休上班" },
                        { id: "event", name: "节日" },
                        ...(h.kind === "reference" ? [{ id: "reference", name: "节日日期（放假安排待公布）" }] : []),
                    ],
                    h.kind,
                ) +
                "</select></label>" +
                '<label id="eventRepeatField"' +
                (h.kind === "event" ? "" : " hidden") +
                '>重复<select id="eventRepeat">' +
                options(
                    [
                        { id: "once", name: "一次性" },
                        { id: "yearly", name: "每年" },
                    ],
                    h.repeat,
                ) +
                "</select></label>" +
                "</div>" +
                check("启用条目", "eventEnabled", h.enabled) +
                '<p id="eventRepeatHelp" class="muted"' +
                (h.kind === "event" ? "" : " hidden") +
                ">每年按公历月日重复，非闰年跳过 2 月 29 日；自定义节日不代表放假</p>" +
                btn("保存事件", "save-event", "", "primary") +
                btn("取消", "cancel-event") +
                "</section>";
        }

        html +=
            '<section><h2>CSV / JSON 导入</h2><label>文件内容（必填 name,start；可选 end,kind,repeat；kind：event/holiday/makeup；repeat：once/yearly，默认 event、once）<textarea id="importText">' + esc(importText) + '</textarea></label><label>选择 CSV 或 JSON 文件<input id="importFile" type="file" accept=".csv,.json"></label><div class="actions">' +
            btn("预览导入", "preview-import") +
            btn("确认预览批次", "apply-import") +
            '</div><pre id="importPreview" hidden></pre><label>回滚导入批次<select id="batchId">' +
            [...new Set(app.config.events.map((h) => h.batchId).filter(Boolean))]
                .map((id) => "<option>" + esc(id) + "</option>")
                .join("") +
            "</select></label>" +
            btn("回滚批次", "rollback-import", "", "danger") +
            "</section>";

        return html;
    }
    async function action(a, id) {
        if (a === "sync") {
            const result = await app.api("maintenance", { job: "sync" });
            reset();
            await app.load();
            app.status(result.message, !result.ok);
            return;
        }

        if (a === "toggle-event") {
            const event = app.config.events.find((h) => h.id === id);
            event.enabled = !event.enabled;
            await app.save(event.enabled ? "条目已启用" : "条目已停用，已退出查询与通知");
            editingEvent = null;
            app.render();
            return;
        }

        if (a === "new-event") {
            originalEvent = undefined;
            editingEvent = {
                ...structuredClone(app.state.calendarDraft),
                id: uid(),
                enabled: true,
                start: "",
                end: "",
                kind: "event",
                source: "manual",
                repeat: "once",
            };
            app.render();
            app.focus("eventName");
            return;
        }

        if (a === "edit-event") {
            editingEvent = structuredClone(app.config.events.find((h) => h.id === id));
            originalEvent = structuredClone(editingEvent);
            app.render();
            app.focus("eventName");
            return;
        }

        if (a === "cancel-event") {
            app.config = structuredClone(app.state.config);
            app.dirty = false;
            editingEvent = null;
            app.render();
            app.focus("app");
            return;
        }

        if (a === "save-event") {
            const value = {
                ...editingEvent,
                enabled: $("eventEnabled").checked,
                name: $("eventName").value,
                start: $("eventStart").value,
                end:
                    $("eventKind").value === "holiday"
                        ? $("eventEnd").value || $("eventStart").value
                        : $("eventStart").value,
                kind: $("eventKind").value,
                repeat: $("eventKind").value === "event" ? $("eventRepeat").value : "once",
            };

            if (
                !value.source ||
                ["name", "start", "end", "kind", "repeat"].some((key) => value[key] !== editingEvent[key])
            ) {
                value.source = "manual";
            }

            put(app.config.events, mergeDraft(app.config.events.find((h) => h.id === value.id), originalEvent, value));
            await app.save();
            editingEvent = null;
            app.render();
            return;
        }

        if (a === "reset-event") {
            if (!app.synchronized) {
                throw Error("配置状态未确认，请先刷新配置");
            }

            if (app.dirty) {
                throw Error("请先保存编辑，再恢复默认");
            }

            if (!(await app.confirmAction("恢复默认数据并跟随接口更新？当前人工修改将被覆盖"))) {
                return;
            }

            try {
                await app.api("event-reset", { id, revision: app.state.revision });
                editingEvent = null;
                app.synchronized = false;
                await app.load();
                app.status("已恢复默认，后续跟随接口更新");
            } catch (error) {
                // Reconcile a potentially successful request whose response was lost.
                app.synchronized = false;

                try {
                    await app.load();
                } catch { }

                throw error;
            }

            return;
        }

        if (a === "delete-event") {
            const holiday = app.config.events.find((h) => h.id === id);

            if (
                !(await app.confirmAction(
                    holiday.source === "uapi" ? "删除条目？后续同步会重新获取" : "删除这个日历事件？",
                ))
            ) {
                return;
            }

            app.config.events = app.config.events.filter((h) => h.id !== id);
            await app.save();
            editingEvent = null;
            app.render();
            return;
        }

        if (a === "preview-import") {
            imported = await app.api("import-preview", {
                text: $("importText").value,
            });
            $("importPreview").hidden = false;
            $("importPreview").textContent = JSON.stringify(imported, null, 2);
            return;
        }

        if (a === "apply-import") {
            if (!imported) {
                throw Error("请先预览导入");
            }

            if (imported.revision !== app.state.revision) {
                throw Error("日历已变化，请刷新后重新预览导入");
            }

            if (imported.conflicts.length && !(await app.confirmAction("存在重叠放假或调休，仍保留为独立条目？"))) {
                return;
            }

            if (app.dirty) {
                throw Error("请先保存事件编辑，再导入");
            }

            app.config.events.push(...imported.items);
            await app.save();
            imported = null;
            importText = "";
            app.render();
            return;
        }

        if (a === "rollback-import") {
            if (app.dirty) {
                throw Error("请先保存事件编辑，再回滚");
            }

            const batch = $("batchId").value;

            if (!batch || !(await app.confirmAction("删除该批次导入的所有假期？"))) {
                return;
            }

            app.config.events = app.config.events.filter((h) => h.batchId !== batch);
            await app.save();
            return;
        }
    }
    function reset() {
        editingEvent = null;
        imported = null;
        importText = "";
    }

    function input(el) {
        if (el.id === "importText") {
            importText = el.value;
            imported = null;
        }
    }
    async function change(el) {
        if (el.id === "eventKind") {
            $("eventEndField").hidden = el.value !== "holiday";
            $("eventRepeatField").hidden = el.value !== "event";
            $("eventRepeatHelp").hidden = el.value !== "event";
        }

        if (el.id === "importFile") {
            await app.run(async () => {
                const file = el.files?.[0];

                if (!file) {
                    return;
                }

                if (file.size > 128000) {
                    throw Error("导入文件超过128KB");
                }

                importText = await file.text();
                $("importText").value = importText;
                imported = null;
            });
        }
    }
    return {
        render,
        action,
        reset,
        change,
        input,
        discardActions: ["toggle-event", "new-event", "edit-event", "delete-event", "sync"],
        transientInputs: ["importFile", "importText", "batchId"],
    };
}
`;
