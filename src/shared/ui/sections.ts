export const sections = String.raw`
function createLazySection(app, ui, key, title, page) {
    let pending = null, failedState = null, error = '';
    const loadingId = app.id + '-' + key + '-loading';
    const render = page.render, refresh = page.refresh, action = page.action;

    async function load() {
        const state = app.state;

        if (state[key] !== null || pending === state) { return; }

        pending = state;
        failedState = null;
        const placeholder = ui.$(loadingId);

        if (placeholder) { placeholder.outerHTML = page.render(); }

        try {
            const value = await app.api(key);
            page.check?.(value);

            if (app.state === state) { state[key] = value; }
        } catch (cause) {
            if (app.state === state) {
                failedState = state;
                error = cause.message;
            }
        } finally {
            if (pending === state) { pending = null; }

            const panel = ui.$(loadingId);

            if (app.state === state && panel) {
                panel.outerHTML = page.render();
                app.refresh();
            }
        }
    }

    page.render = () => {
        if (app.state[key] !== null) { return '<div id="' + loadingId + '">' + render() + '</div>'; }

        const failed = failedState === app.state;

        return '<section class="loading-placeholder" id="' + loadingId + '" aria-busy="' + (pending === app.state) + '"><h2>' + ui.esc(title) + '</h2><p' + (failed ? ' class="error"' : '') + '>' + ui.esc(failed ? error : pending === app.state ? '正在加载…' : '尚未加载') + '</p>' + (pending === app.state ? '<div class="skeleton-line"></div>' : ui.btn(failed ? '重新加载' : '查看详情', loadingId)) + '</section>';
    };
    page.refresh = () => {
        if (app.state[key] !== null) { refresh?.(); }
    };
    page.action = async (a, id) => {
        if (a === loadingId) { await load(); } else { await action?.(a, id); }
    };

    return page;
}

function createSections(app, ui, title, entries) {
    let selected = Object.keys(entries)[0];
    const hasTabs = Object.keys(entries).length > 1;
    const prefix = (app.id || app.page) + '-section-';
    const pages = {};
    const current = () => pages[selected] ??= entries[selected].create();

    function ready() {
        return !!app.state && (selected !== 'copy' || !!app.state.copyEditor) && (!['settings', 'images'].includes(selected) || !!app.state.settings);
    }

    function header() {
        const copy = ['copy', 'templates'].includes(selected), loaded = current().loaded?.() ?? ready(), loading = app.loading || current().isLoading?.();

        return ui.sectionHeader(copy ? '消息模板' : entries[selected].label, '<span id="section-status" role="status">' +
            (loading ? '正在加载…' : loaded ? app.dirty ? '有未保存的修改' : '暂无未保存修改' : '尚未加载') + '</span>' +
            '<span id="dirty" role="status" hidden>有未保存的修改</span>' + ui.btn(loaded ? '重新加载' : copy ? '加载模板' : current().load ? '加载卡面' : '加载配置', current().loadAction?.() || 'reload'));
    }

    function render() {
        const customLoad = current().load;
        const local = entries[selected].local;
        const placeholder = app.loading ? '<div class="loading-placeholder" role="status" aria-label="正在加载配置"><span>正在加载…</span><div class="skeleton-line"></div><div class="skeleton-line"></div></div>' : '';
        const content = !app.loading && (local || ready() || customLoad) ? current().render() : '';

        return (
            (hasTabs ? '<nav class="subnav" role="tablist" aria-label="' +
                ui.esc(title) +
                '">' +
                Object.entries(entries)
                    .map(
                        ([id, entry]) =>
                            '<button id="' + prefix + id + '-tab" aria-controls="' + prefix + id + '" role="tab" aria-selected="' + (id === selected) + '" tabindex="' + (id === selected ? 0 : -1) + '" data-action="section" data-id="' +
                            ui.esc(id) +
                            '"' +
                            (id === selected ? ' aria-current="true" class="active"' : "") +
                            ">" +
                            ui.esc(entry.label) +
                            "</button>",
                    )
                    .join("") +
                "</nav>" : "") +
            '<div role="' + (hasTabs ? 'tabpanel' : 'region') + '" id="' + prefix + selected + '" ' + (hasTabs ? 'aria-labelledby="' + prefix + selected + '-tab"' : 'aria-label="' + ui.esc(title) + '"') + '>' + (local ? '' : header()) + placeholder + '<div id="section-controls"' + (!app.loading && (ready() || local || customLoad) ? '' : ' hidden') + '>' + content + '</div>' + (!app.loading && !ready() && !local && !customLoad ? '<p class="muted">' + ui.esc(app.loadError || '点击加载后查看配置') + '</p>' : '') + '</div>'
        );
    }

    async function action(a, id) {
        if (a === "section") {
            reset(false);
            selected = id;
            app.render();
            app.focus(prefix + selected + '-tab');

            return;
        }

        await current().action(a, id);
    }

    function reset(invalidate = true) {
        for (const page of Object.values(pages)) {
            page.reset?.(invalidate);
        }
    }

    return {
        get activeSection() { return selected; },
        get discardActions() { return current().discardActions || []; },
        get transientInputs() { return current().transientInputs || []; },
        render,
        load: () => current().load ? current().load() : app.load(),
        remember: () => current().remember?.(),
        get isDirty() { return ready() ? current().isDirty : undefined; },
        isNew: () => current().isNew?.(),
        buttonsDirty: () => current().buttonsDirty?.(),
        refresh: () => { if (!app.loading && (ready() || current().load || entries[selected].local)) { current().refresh?.(); } },
        action,
        reset,
        input: (el) => { if (ready() || entries[selected].local || current().load) { current().input?.(el); } },
        change: (el) => { if (ready() || entries[selected].local || current().load) { current().change?.(el); } },
        focus: (el) => current().focus?.(el),
    };
}
`;
