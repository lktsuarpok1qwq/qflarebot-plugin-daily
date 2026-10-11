export const application = String.raw`
function createApp(bridge, ui, factories) {
    const { $, btn } = ui;
    const app = { state: null, config: null, page: "tasks", dirty: false, synchronized: false };
    let running = false;
    const pages = Object.fromEntries(Object.entries(factories).map(([key, create]) => [key, create(app, ui)]));
    const titles = {
        tasks: "任务管理",
        recipients: "发送对象",
        copy: "文案设置",
        calendar: "日历",
        status: "运行状态与备份",
    };
    async function api(action, data) {
        const res = await bridge.fetch(
            "/api/" + action,
            data === undefined
                ? {}
                : {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify(data),
                  },
        );
        const value = await res.json();

        if (!res.ok) {
            throw Error(value.error || "请求失败");
        }

        return value;
    }
    function status(text, error = false) {
        $("status").textContent = text;
        $("status").className = error ? "error" : "";
    }
    function confirmAction(message) {
        const dialog = $("decision");
        $("decisionText").textContent = message;
        $("decisionAccept").disabled = false;
        $("decisionCancel").disabled = false;
        return new Promise((resolve) => {
            const close = (accepted) => {
                dialog.close();
                resolve(accepted);
            };
            $("decisionAccept").onclick = () => close(true);
            $("decisionCancel").onclick = () => close(false);
            dialog.oncancel = (event) => {
                event.preventDefault();
                close(false);
            };
            dialog.showModal();
            $("decisionCancel").focus();
        });
    }
    async function run(fn) {
        if (running) {
            return;
        }

        running = true;
        document.body.classList.add("busy");
        document.querySelectorAll("button,input,select,textarea").forEach((b) => (b.disabled = true));

        try {
            await fn();
        } catch (e) {
            app.status(e.message, true);
        } finally {
            running = false;
            document.body.classList.remove("busy");
            document
                .querySelectorAll("button,input,select,textarea")
                .forEach((b) => (b.disabled = b.hasAttribute("data-locked")));
        }
    }
    async function load() {
        const fresh = await app.api("state");
        app.state = fresh;
        app.config = structuredClone(app.state.config);
        app.synchronized = true;
        app.dirty = false;
        app.render();
    }
    async function save(message = "已保存") {
        if (!app.synchronized) {
            throw Error("配置状态未确认，请先刷新配置");
        }

        const candidate = structuredClone(app.config),
            wasDirty = app.dirty;
        const draft = wasDirty
            ? [...document.querySelectorAll("#app input[id],#app textarea[id],#app select[id]")]
                  .filter((el) => el.type !== "file")
                  .map((el) => ({
                      id: el.id,
                      value: el.value,
                      checked: el.checked,
                      selected: el.multiple ? [...el.selectedOptions].map((o) => o.value) : null,
                  }))
            : [];
        // Do not let a rejected edit leak into a later unrelated save.
        app.config = structuredClone(app.state.config);

        try {
            await app.api("config", { revision: app.state.revision, config: candidate });
            app.synchronized = false;
            await app.load();
            app.status(message);
        } catch (error) {
            // A lost response can hide a successful save. Reconcile before more mutations.
            try {
                await app.load();
            } catch {
                app.synchronized = false;
            }

            for (const field of draft) {
                const el = $(field.id);

                if (!el) {
                    continue;
                }

                if (field.selected) {
                    for (const option of el.options) {
                        option.selected = field.selected.includes(option.value);
                    }
                } else {
                    el.value = field.value;
                }

                if (field.checked !== undefined) {
                    el.checked = field.checked;
                }
            }

            app.dirty = wasDirty;
            throw error;
        }
    }
    function resetDrafts() {
        for (const page of Object.values(pages)) {
            page.reset?.();
        }
    }
    function openCopy(id) {
        app.page = "copy";
        pages.copy.selectTask(id);
        render();
    }
    function render() {
        $("nav").innerHTML = Object.entries(titles)
            .map(([id, name]) => btn(name, "page", id, id === app.page ? "active" : ""))
            .join("");
        let html = '<div class="actions">' + btn("刷新配置", "reload") + "</div>";

        if (!app.synchronized) {
            html += '<div class="notice">配置状态未确认，请刷新后继续。</div>';
        }

        if (app.config.paused) {
            html += '<div class="notice">全局紧急暂停中。查询、预览和每日维护仍可运行。</div>';
        }

        $("app").innerHTML = html + pages[app.page].render();
    }
    async function action(a, id) {
        const discardsDraft = [
            "reload",
            "page",
            "new-task",
            "edit-task",
            "copy-task",
            "toggle-task",
            "delete-task",
            "new-recipient",
            "edit-recipient",
            "toggle-recipient",
            "delete-recipient",
            "new-event",
            "edit-event",
            "delete-event",
            "sync",
            "cleanup",
            "pause",
            "task-copy",
        ];

        if (app.dirty && discardsDraft.includes(a)) {
            if (!(await confirmAction("有未保存的编辑，放弃后继续？"))) {
                return;
            }

            app.config = structuredClone(app.state.config);
            resetDrafts();
            app.dirty = false;
        }

        if (a === "reload") {
            resetDrafts();
            await load();
            return;
        }

        if (a === "page") {
            app.config = structuredClone(app.state.config);
            app.dirty = false;
            resetDrafts();
            app.page = id;
            render();
            return;
        }

        if (a === "sync" || a === "cleanup") {
            const result = await api("maintenance", { job: a });
            pages.calendar.reset();
            await load();
            status(result.message, !result.ok);
            return;
        }

        await pages[app.page].action(a, id);
    }
    const changesConfig = (el) =>
        el.closest("#app") &&
        ![
            "testRecipient",
            "commandName",
            "copySection",
            "copyTask",
            "logTask",
            "logRecipient",
            "logStatus",
            "backupFile",
            "importFile",
            "importText",
            "batchId",
        ].includes(el.id);
    function start() {
        document.addEventListener("click", (e) => {
            const b = e.target.closest("button[data-action]");

            if (b) {
                run(() => action(b.dataset.action, b.dataset.id));
            }
        });
        document.addEventListener("focusin", (e) => pages[app.page].focus?.(e.target));
        document.addEventListener("input", (e) => {
            if (changesConfig(e.target)) {
                app.dirty = true;
            }

            pages[app.page].input?.(e.target);
        });
        document.addEventListener("change", (e) => {
            if (changesConfig(e.target)) {
                app.dirty = true;
            }

            pages[app.page].change?.(e.target);
        });
        bridge.resize();
        return run(load);
    }
    Object.assign(app, { api, status, confirmAction, run, load, save, render, openCopy, resetDrafts, start });
    return app;
}
`;
