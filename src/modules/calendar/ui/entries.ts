export const calendarEntries = String.raw`
function createCalendarEntries(app, ui) {
    const { $, esc, uid, time, options, field, btn, table, put, check, mergeDraft } = ui;
    let editingEvent, originalEvent;
    const overview = createLazySection(app, ui, "overview", "年度数据", { render: renderOverview });

    function renderOverview() {
        let html = "";

        html +=
            '<section><h2>年度数据</h2><p class="muted">同步当年和明年数据，保留人工修改</p><details id="syncHelp"><summary>更新频率与数据说明</summary><p class="muted">未公布放假安排时仅记录节日日期<br>00:00 检查当年，00:01 检查明年<br>当年已有安排或明年七个节日安排齐全时每 7 天同步，其余每天同步<br>失败次日重试，立即同步不受间隔限制<br>00:10 清理往年已结束的条目</p></details>' +
            btn("立即同步", "sync", "", "primary") +
            table(
                ["年份", "数据变更时间", "最近检查成功", "获取频率", "状态", "来源"],
                app.state.overview.sources.map(
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
                        (s.cached ? "使用缓存；" : "") + esc(
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
            esc(JSON.stringify(app.state.overview.jobs, null, 2)) +
            "</pre></details>" +
            (app.state.conflicts.length ? '<p class="notice">以下放假与调休记录冲突，已暂停用于查询和通知，请编辑核对</p><ul>' + app.state.conflicts.map((h) => '<li>' + esc(h.name + ' · ' + h.start + (h.end !== h.start ? ' 至 ' + h.end : '') + ' · ' + (h.kind === 'holiday' ? '放假' : '调休')) + '</li>').join('') + '</ul>' : '') + '</section>';
        return html;
    }
    function render() {
        let html = overview.render();
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
                '<fieldset><legend>功能开关</legend>' + check("启用条目", "eventEnabled", h.enabled) + "</fieldset>" +
                '<p id="eventRepeatHelp" class="muted"' +
                (h.kind === "event" ? "" : " hidden") +
                ">每年按公历月日重复，非闰年跳过 2 月 29 日；自定义节日不代表放假</p>" +
                btn("保存事件", "save-event", "", "primary") +
                btn("取消", "cancel-event") +
                "</section>";
        }

        return html;
    }
    async function action(a, id) {
        await overview.action(a, id);

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
            await app.save(event.enabled ? "条目已启用" : "条目已停用，已退出查询与通知", () => { editingEvent = null; });
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
            await app.save(undefined, () => { editingEvent = null; });
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
                const saved = await app.api("event-reset", { id, revision: app.state.revision });
                app.state = { ...app.state, ...saved };
                app.config = structuredClone(saved.config);
                editingEvent = null;
                app.render();
                app.status("已恢复默认，后续跟随接口更新");
            } catch (error) {
                if (error.kind === "validation") { throw error; }

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
            await app.save(undefined, () => { editingEvent = null; });
            return;
        }
    }
    function reset() {
        editingEvent = null;
    }

    function change(el) {
        if (el.id === "eventKind") {
            $("eventEndField").hidden = el.value !== "holiday";
            $("eventRepeatField").hidden = el.value !== "event";
            $("eventRepeatHelp").hidden = el.value !== "event";
        }
    }
    return {
        refresh: overview.refresh,
        render,
        action,
        reset,
        change,
        discardActions: ["toggle-event", "new-event", "edit-event", "delete-event", "sync"],
    };
}
`;
