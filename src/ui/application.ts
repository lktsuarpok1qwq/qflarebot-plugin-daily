export const application = String.raw`
function createApp(bridge, ui, factories) {
    const { $ } = ui;
    const markdownPreview = createMarkdownPreview(ui);
    const app = { state: null, config: null, page: "tasks", dirty: false, synchronized: false };
    let running = false,
        pendingFocus;
    const stores = Object.fromEntries(
        Object.entries(factories).map(([key, entry]) => [key, entry.module ? createScope(app, key) : app]),
    );
    const pages = Object.fromEntries(
        Object.entries(factories).map(([key, entry]) => [key, entry.create(stores[key], ui)]),
    );
    const titles = Object.fromEntries(Object.entries(factories).map(([key, entry]) => [key, entry.title]));
    const current = () => stores[app.page];
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
    function focusState() {
        const el = document.activeElement;
        return el
            ? {
                id: el.id,
                action: el.dataset.action,
                target: el.dataset.id,
                start: el.selectionStart,
                end: el.selectionEnd,
            }
            : null;
    }
    function restoreFocus(state) {
        if (!state) {
            return;
        }

        const el = state.id
            ? $(state.id)
            : [...document.querySelectorAll("button[data-action]")].find(
                (button) =>
                    state.action && button.dataset.action === state.action && button.dataset.id === state.target,
            );
        el?.focus({ preventScroll: true });

        if (el && state.start != null) {
            el.setSelectionRange(state.start, state.end);
        }
    }
    function focus(id) {
        pendingFocus = id;
    }
    function updateDirty() {
        $("dirty").hidden = !app.dirty;
    }
    async function run(fn) {
        if (running) {
            return;
        }

        const previousFocus = focusState();
        running = true;
        $("app").setAttribute("aria-busy", "true");
        document.body.classList.add("busy");
        document.querySelectorAll("button,input,select,textarea").forEach((b) => (b.disabled = true));

        try {
            await fn();
        } catch (e) {
            app.status(e.message, true);
        } finally {
            running = false;
            document.body.classList.remove("busy");
            $("app").setAttribute("aria-busy", "false");
            document
                .querySelectorAll("button,input,select,textarea")
                .forEach((b) => (b.disabled = b.hasAttribute("data-locked")));
            updateDirty();

            if (pendingFocus && $(pendingFocus)) {
                const el = $(pendingFocus);
                (el.closest("section") || el).scrollIntoView({ block: "nearest" });
                el.focus({ preventScroll: true });
            } else {
                restoreFocus(previousFocus);
            }

            pendingFocus = null;
            markdownPreview.refresh();
        }
    }
    async function load(store = current()) {
        const fresh = await store.api("state");
        store.state = fresh;
        store.config = structuredClone(store.state.config);
        store.synchronized = true;
        app.dirty = false;
        app.render();
        app.status("配置已加载");
    }
    async function save(message = "已保存", store = current()) {
        if (!store.synchronized) {
            throw Error("配置状态未确认，请先刷新配置");
        }

        const candidate = structuredClone(store.config),
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
        store.config = structuredClone(store.state.config);

        try {
            await store.api("config", { revision: store.state.revision, config: candidate });
            store.synchronized = false;
            await load(store);
            app.status(message);
        } catch (error) {
            // A lost response can hide a successful save. Reconcile before more mutations.
            try {
                await load(store);
            } catch {
                store.synchronized = false;
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
    function render() {
        const previousFocus = focusState(),
            scroll = { x: window.scrollX, y: window.scrollY };
        const editor = document.querySelector(".markdown-editor"),
            editorId = editor?.querySelector("textarea")?.id,
            editorScroll = editor?.scrollTop;
        const expanded = [...document.querySelectorAll("#app details[id][open]")].map((el) => el.id);
        $("nav").innerHTML = Object.entries(titles)
            .map(
                ([id, name]) =>
                    '<button data-action="page" data-id="' +
                    id +
                    '"' +
                    (id === app.page ? ' class="active" aria-current="page"' : "") +
                    ">" +
                    name +
                    "</button>",
            )
            .join("");
        let html = "";

        if (!current().synchronized) {
            html += '<div class="notice">配置未确认，请刷新</div>';
        }

        if (app.config.paused) {
            html += '<div class="notice">发送已暂停，查询和维护照常运行</div>';
        }

        $("app").innerHTML = html + (current().state ? pages[app.page].render() : "");

        for (const id of expanded) {
            if ($(id)) {
                $(id).open = true;
            }
        }

        updateDirty();
        markdownPreview.refresh();
        restoreFocus(previousFocus);
        const nextEditor = document.querySelector(".markdown-editor");

        if (editorId && nextEditor?.querySelector("textarea")?.id === editorId) {
            nextEditor.scrollTop = editorScroll;
        }

        window.scrollTo(scroll.x, scroll.y);
    }
    async function action(a, id) {
        const discardsDraft = [
            "reload",
            "page",
            "section",
            "new-template",
            "edit-template",
            "delete-template",
            "new-task",
            "edit-task",
            "copy-task",
            "toggle-task",
            "delete-task",
            "new-recipient",
            "edit-recipient",
            "toggle-recipient",
            "delete-recipient",
            "cleanup",
            "pause",
        ];

        if (app.dirty && [...discardsDraft, ...(pages[app.page].discardActions || [])].includes(a)) {
            if (!(await confirmAction("有未保存的编辑，放弃后继续？"))) {
                return;
            }

            current().config = structuredClone(current().state.config);
            resetDrafts();
            app.dirty = false;
        }

        if (a === "reload") {
            resetDrafts();
            await load();
            return;
        }

        if (a === "page") {
            current().config = structuredClone(current().state.config);
            app.dirty = false;
            resetDrafts();
            const previousPage = app.page;
            app.page = id;

            try {
                await load();
            } catch (error) {
                app.page = previousPage;
                render();
                throw error;
            }

            return;
        }

        if (a === "cleanup") {
            const result = await api("maintenance", { job: a });
            await load();
            status(result.message, !result.ok);
            return;
        }

        if (a === "markup") {
            const { id: target, before, after } = JSON.parse(id),
                el = $(target);
            const selected = el.value.slice(el.selectionStart, el.selectionEnd) || "文字";
            el.setRangeText(before + selected + after, el.selectionStart, el.selectionEnd, "end");
            el.dispatchEvent(new Event("input", { bubbles: true }));
            focus(target);
            return;
        }

        await pages[app.page].action(a, id);
    }
    const changesConfig = (el) =>
        el.closest("#app") &&
        !["testRecipient", "commandName", "logTask", "logRecipient", "logStatus", "backupFile"].includes(el.id) &&
        !(pages[app.page].transientInputs || []).includes(el.id);
    function start() {
        document.addEventListener("click", (e) => {
            const b = e.target.closest("button[data-action]");

            if (b) {
                run(() => action(b.dataset.action, b.dataset.id));
            }
        });
        document.addEventListener("focusin", (e) => {
            pages[app.page].focus?.(e.target);
            markdownPreview.focus(e.target);
        });
        document.addEventListener("input", (e) => {
            if (changesConfig(e.target)) {
                app.dirty = true;
            }

            updateDirty();
            pages[app.page].input?.(e.target);
            markdownPreview.input(e.target);
        });
        document.addEventListener("change", (e) => {
            if (changesConfig(e.target)) {
                app.dirty = true;
            }

            updateDirty();
            pages[app.page].change?.(e.target);
            markdownPreview.refresh();
        });
        bridge.resize();
        return run(load);
    }
    Object.assign(app, { api, status, confirmAction, run, load, save, render, focus, resetDrafts, start });
    return app;
}
`;
