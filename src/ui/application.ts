export const application = String.raw`
function createApp(bridge, ui, factories) {
    const { $ } = ui;
    const markdownPreview = createMarkdownPreview(ui, () => page().refresh?.());
    const selectPicker = createSelectPicker();
    const notify = createFeedback(bridge);
    const fieldBaselines = new Map(), textEditors = new WeakMap();
    let disabledBeforeRun = new WeakMap();
    const app = { state: null, config: null, page: Object.keys(factories)[0], dirty: false, synchronized: false };
    let running = false,
        pendingFocus, pendingSelection;
    const stores = Object.fromEntries(
        Object.entries(factories).map(([key, entry]) => [key, entry.module ? createScope(app, key, entry.checkState) : app]),
    );
    const pages = {};
    const page = () => pages[app.page] ??= factories[app.page].create(stores[app.page], ui);
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
            throw Object.assign(Error(value.error || "请求失败"), { kind: value.kind });
        }

        return value;
    }

    function status(text, error = false) {
        notify(text, error);
    }

    const confirmAction = createConfirmation(ui);

    function focusState() {
        const el = document.activeElement;

        return el
            ? {
                id: el.id,
                context: el.dataset.editorContext,
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

        if (state.context !== undefined && state.context !== el?.dataset.editorContext) { return; }

        const top = el?.scrollTop;
        el?.focus({ preventScroll: true });

        if (el && state.start != null) {
            el.setSelectionRange(state.start, state.end);
        }

        if (el && top !== undefined) { el.scrollTop = top; }
    }

    function focus(id, start, end = start) {
        pendingFocus = id;
        pendingSelection = Number.isInteger(start) ? { start, end } : null;
    }

    function fieldValue(el) {
        return el.type === 'checkbox' ? el.checked : el.multiple ? [...el.selectedOptions].map(option => option.value) : el.value;
    }

    function draftFields() {
        return [...document.querySelectorAll('#app input[id],#app textarea[id],#app select[id]')]
            .filter(el => el.type !== 'file' && !el.readOnly && changesConfig(el));
    }

    function updateDirty() {
        if (!current().state) { return; }

        const component = page();
        app.dirty = JSON.stringify(current().config) !== JSON.stringify(current().state.config)
            || Boolean(component.isNew?.())
            || Boolean(component.buttonsDirty?.())
            || (component.isDirty ? component.isDirty() : draftFields().some(el => JSON.stringify(fieldValue(el)) !== fieldBaselines.get(el.id)));
        const dirty = $('dirty');

        if (dirty) { dirty.hidden = running || !app.dirty; }

        const state = $('section-status');

        if (state) {
            state.hidden = !running && app.dirty;
            state.textContent = current().loading ? '正在加载…' : running ? '正在处理…' : !current().state ? '尚未加载' : '暂无未保存修改';
        }
    }

    function lockControls() {
        document.querySelectorAll('button,input,select,textarea').forEach(el => {
            if (el.closest('dialog[open]')) { return; }

            if (running && !disabledBeforeRun.has(el)) { disabledBeforeRun.set(el, el.disabled && !el.dataset.draftAction && !el.hasAttribute('data-managed-disabled')); }

            el.disabled = running || disabledBeforeRun.get(el) === true || el.hasAttribute('data-locked')
                || Boolean(el.dataset.draftAction && !app.dirty);
        });
    }

    function refresh() {
        selectPicker.refresh();
        markdownPreview.refresh();

        page().refresh?.();

        for (const el of document.querySelectorAll('.markdown-editor textarea')) {
            if (textEditors.has(el)) { continue; }

            const tools = createTextTools(el, () => {
                page().input?.(el);
                markdownPreview.input(el);
                updateDirty();
                lockControls();
            });
            textEditors.set(el, tools);
            tools.retainSelection(el.closest('.markdown-workspace').querySelector('.markdown-source-tools'));
            const variables = document.querySelector('.variable-reference');

            if (variables) { tools.retainSelection(variables); }
        }

        updateDirty();
        lockControls();
    }

    async function run(fn) {
        if (running) {
            return;
        }

        const previousFocus = focusState();
        running = true;
        $("app").setAttribute("aria-busy", "true");
        document.body.classList.add("busy");
        updateDirty();
        lockControls();

        try {
            await fn();
        } catch (e) {
            if (!e.fieldHandled) { app.status(e.message, true); }
        } finally {
            running = false;
            document.body.classList.remove("busy");
            $("app").setAttribute("aria-busy", "false");
            updateDirty();
            lockControls();
            disabledBeforeRun = new WeakMap();

            if (pendingFocus && $(pendingFocus)) {
                const el = $(pendingFocus);
                el.scrollIntoView({ block: "nearest" });
                el.focus({ preventScroll: true });

                if (pendingSelection && el.setSelectionRange) { el.setSelectionRange(pendingSelection.start, pendingSelection.end); }
            } else {
                restoreFocus(previousFocus);
            }

            pendingFocus = null;
            pendingSelection = null;
            markdownPreview.refresh();
        }
    }

    async function load(store = current(), redraw = true, announce = true) {
        let fresh;
        store.loading = true;

        if (redraw) { app.render(); }

        try {
            const full = !store.state?.copyEditor && !store.state?.settings;
            fresh = store.checkedState(await store.api(full ? 'state' : 'state?data=1'), full);
            store.loadError = '';
        } catch (error) {
            store.loadError = error.message;

            throw error;
        } finally {
            store.loading = false;

            if (store.loadError && redraw) { app.render(); }
        }

        fieldBaselines.clear();
        store.state = fresh;
        store.config = structuredClone(store.state.config);
        store.synchronized = true;
        app.dirty = false;

        if (redraw) {
            app.render();

            if (announce) { app.status("配置已加载"); }
        }
    }

    async function save(message = "已保存", afterSave, store = current()) {
        if (!store.synchronized) {
            throw Error("配置状态未确认，请先刷新配置");
        }

        const candidate = structuredClone(store.config),
            wasDirty = app.dirty;

        if (JSON.stringify(candidate) === JSON.stringify(store.state.config)) {
            afterSave?.();
            app.dirty = false;
            fieldBaselines.clear();
            app.render();

            return;
        }

        const draft = wasDirty
            ? [...document.querySelectorAll("#app input[id],#app textarea[id],#app select[id]")]
                .filter((el) => el.type !== "file")
                .map((el) => ({
                    id: el.id,
                    context: el.dataset.editorContext,
                    value: el.value,
                    checked: el.checked,
                    selected: el.multiple ? [...el.selectedOptions].map((o) => o.value) : null,
                }))
            : [];
        // 被拒绝的编辑不得混入后续无关保存
        store.config = structuredClone(store.state.config);

        try {
            const saved = store.checkedState(await store.api("config", { revision: store.state.revision, config: candidate }));
            store.state = saved;
            store.config = structuredClone(saved.config);
            store.synchronized = true;
            app.dirty = false;

            afterSave?.();
            fieldBaselines.clear();
            app.render();
            app.status(message);
        } catch (error) {
            // 只有明确在写入前被拒绝时才可跳过状态核对
            if (error.kind !== "validation") {
                try {
                    await load(store, true, false);
                } catch {
                    store.synchronized = false;
                }
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

    function resetDrafts(invalidate = true) {
        fieldBaselines.clear();

        page().reset?.(invalidate);
    }

    function render() {
        page().remember?.();
        const previousFocus = focusState(),
            scroll = { x: window.scrollX, y: window.scrollY };
        const editor = document.querySelector(".markdown-editor"),
            editorId = editor?.querySelector("textarea")?.id,
            editorScroll = editor?.scrollTop;
        const expanded = [...document.querySelectorAll("#app details[id][open]")].map((el) => el.id);
        $('nav').innerHTML = Object.entries(titles).map(([id, name]) =>
            '<button id="page-' + id + '" role="tab" aria-controls="app" aria-selected="' + (id === app.page) + '" tabindex="' + (id === app.page ? 0 : -1) + '" data-action="page" data-id="' + id + '"' + (id === app.page ? ' class="active"' : '') + '>' + name + '</button>'
        ).join('');
        $('app').setAttribute('aria-labelledby', 'page-' + app.page);
        let html = "";

        if (current().state && !current().synchronized) {
            html += '<div class="notice">配置未确认，请刷新</div>';
        }

        $('app').innerHTML = html + page().render();

        if (!app.dirty) { fieldBaselines.clear(); }

        for (const el of draftFields()) {
            if (!fieldBaselines.has(el.id)) { fieldBaselines.set(el.id, JSON.stringify(fieldValue(el))); }
        }

        for (const id of expanded) {
            if ($(id)) {
                $(id).open = true;
            }
        }

        updateDirty();
        refresh();
        restoreFocus(previousFocus);
        const nextEditor = document.querySelector(".markdown-editor");

        if (editorId && nextEditor?.querySelector("textarea")?.id === editorId) {
            nextEditor.scrollTop = editorScroll;
        }

        window.scrollTo(scroll.x, scroll.y);
    }

    async function action(a, id) {
        if (a === "page" && id === app.page) { return; }

        if (a === "section" && id === page().activeSection) { return; }

        const discardsDraft = [
            "reload",
            "page",
            "section",
        ];

        if (app.dirty && [...discardsDraft, ...(page().discardActions || [])].includes(a)) {
            if (!(await confirmAction("有未保存的编辑，放弃后继续？"))) {
                return;
            }

            current().config = structuredClone(current().state.config);
            resetDrafts(a === "reload");
            app.dirty = false;
        }

        if (a === "reload") {
            resetDrafts();
            await page().load();

            return;
        }

        if (a === "page") {
            if (current().state) { current().config = structuredClone(current().state.config); }

            app.dirty = false;
            resetDrafts(false);
            app.page = id;
            render();

            return;
        }

        if (a === 'markup' || a === 'insert-variable') {
            const data = JSON.parse(id), el = $(data.id);

            if (!el || running) { return; }

            const tools = textEditors.get(el);

            if (!tools) { return; }

            tools.insert(a === 'insert-variable' ? data.value : data.before, data.after || '', data.fallback ?? '', a === 'insert-variable', data.line);
            updateDirty();
            lockControls();

            return;
        }

        await page().action(a, id);
        updateDirty();
    }

    const changesConfig = (el) =>
        el.closest("#app") &&
        !el.dataset.buttonControl &&
        !(page().transientInputs || []).includes(el.id);

    function start() {
        document.addEventListener("click", (e) => {
            if (e.target.closest('.message-preview a')) {
                e.preventDefault();
                app.status('预览链接不执行，请在 QQ 中查看实际效果');

                return;
            }

            const b = e.target.closest("button[data-action]");

            if (b) {
                if (['markup', 'insert-variable'].includes(b.dataset.action)) {
                    void action(b.dataset.action, b.dataset.id).catch(e => status(e.message, true));
                } else { run(() => action(b.dataset.action, b.dataset.id)); }
            }
        });
        document.addEventListener("focusin", (e) => {
            page().focus?.(e.target);
            markdownPreview.focus(e.target);
        });
        document.addEventListener('input', e => {
            if (!e.target.closest('#app')) { return; }

            ui.clearFieldError(e.target);
            page().input?.(e.target);
            markdownPreview.input(e.target);
            updateDirty();
            lockControls();
        });
        document.addEventListener('change', e => {
            if (!e.target.closest('#app')) { return; }

            ui.clearFieldError(e.target);
            page().change?.(e.target);
            markdownPreview.refresh();
            updateDirty();
            lockControls();
        });
        document.addEventListener('keydown', e => {
            const tab = e.target.closest('[role="tab"]');

            if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { return; }

            const tabs = [...tab.parentElement.querySelectorAll('[role="tab"]')];
            const index = tabs.indexOf(tab);
            const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length;
            e.preventDefault();
            tabs[next].focus();
            tabs[next].click();
        });
        bridge.resize();

        render();

        return Promise.resolve();
    }

    Object.assign(app, { checkedState: (value, full = false) => checkedConfigState(value, app.state, full), resource: (path, init) => bridge.fetch(path, init), api, status, updateDirty, confirmAction, run, load, save, render, refresh, focus, resetDrafts, start });

    return app;
}
`;
