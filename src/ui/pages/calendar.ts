export const calendarPage = String.raw`
function createCalendarPage(app, ui) {
    const { $, esc, uid, time, options, field, btn, table, put } = ui;
    let editingEvent, imported;

    function render() {
        let html = "";

        html +=
            '<section><h2>年度数据</h2><p class="muted">只同步当年和明年的数据，UAPI 仅查询法定放假与调休。当年和明年未公布安排的节日，从同一响应补充节日日期，不代表放假区间。北京时间每日 00:00 检查当年、00:01 检查明年；当年已有安排及明年七个节日安排齐全时每 7 天获取一次，其余每天获取。失败次日重试；立即同步不受间隔限制。00:10 清理。自动清理往年已结束的记录；人工修改不会被同步覆盖。</p>' +
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
            "</section>";
        html +=
            "<section><h2>日历事件</h2>" +
            btn("新增事件", "new-event", "", "primary") +
            table(
                ["名称", "日期", "类别", "来源", "操作"],
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
                        "</td><td>" +
                        btn("编辑", "edit-event", h.id) +
                        (h.source === "manual" && /^uapi-(?:holiday|makeup|reference)-\d{4}-/.test(h.id)
                            ? btn("恢复默认", "reset-event", h.id)
                            : "") +
                        btn("删除", "delete-event", h.id) +
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
                '</div><p class="muted">每年重复从所填日期开始，按公历月日计算；2 月 29 日在非闰年跳过。自定义节日不代表放假。</p>' +
                btn("保存事件", "save-event", "", "primary") +
                "</section>";
        }

        html +=
            '<section><h2>CSV / JSON 导入</h2><label>文件内容（必填 name,start；可选 end,kind,repeat。kind 为 event/holiday/makeup；repeat 为 once/yearly，默认 event、once）<textarea id="importText"></textarea></label><input id="importFile" type="file" accept=".csv,.json"><div class="actions">' +
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
        if (a === "new-event") {
            editingEvent = {
                ...structuredClone(app.state.draftDefaults.event),
                id: uid(),
                start: "",
                end: "",
                kind: "event",
                source: "manual",
                repeat: "once",
            };
            app.render();
            return;
        }

        if (a === "edit-event") {
            editingEvent = structuredClone(app.config.events.find((h) => h.id === id));
            app.render();
            return;
        }

        if (a === "save-event") {
            const value = {
                ...editingEvent,
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

            put(app.config.events, value);
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

            if (!(await app.confirmAction("恢复这条事件的默认数据？人工修改将被覆盖，后续跟随接口更新。"))) {
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
                } catch {}

                throw error;
            }

            return;
        }

        if (a === "delete-event") {
            const holiday = app.config.events.find((h) => h.id === id);

            if (
                !(await app.confirmAction(
                    holiday.source === "uapi" ? "删除这条缓存记录？后续同步会重新获取。" : "删除这个日历事件？",
                ))
            ) {
                return;
            }

            app.config.events = app.config.events.filter((h) => h.id !== id);
            await app.save();
            return;
        }

        if (a === "preview-import") {
            imported = await app.api("import-preview", {
                text: $("importText").value,
            });
            imported.revision = app.state.revision;
            $("importPreview").hidden = false;
            $("importPreview").textContent = JSON.stringify(imported, null, 2);
            return;
        }

        if (a === "apply-import") {
            if (!imported || imported.revision !== app.state.revision) {
                throw Error("请先重新预览导入");
            }

            if (imported.conflicts.length && !(await app.confirmAction("存在重叠放假或调休，仍保留为独立条目？"))) {
                return;
            }

            app.config.events.push(...imported.items);
            await app.save();
            imported = null;
            return;
        }

        if (a === "rollback-import") {
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
    }

    function input(el) {
        if (el.id === "importText") {
            imported = null;
        }
    }
    async function change(el) {
        if (el.id === "eventKind") {
            $("eventEndField").hidden = el.value !== "holiday";
            $("eventRepeatField").hidden = el.value !== "event";
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

                $("importText").value = await file.text();
                imported = null;
            });
        }
    }
    return { render, action, reset, change, input };
}
`;
