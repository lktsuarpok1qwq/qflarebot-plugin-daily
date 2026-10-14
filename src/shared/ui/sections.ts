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

        try {
            const value = await app.api(key);

            if (app.state === state) { state[key] = value; }
        } catch (cause) {
            if (app.state === state) { failedState = state; error = cause.message; }
        } finally {
            if (pending === state) { pending = null; }

            const panel = ui.$(loadingId);

            if (app.state === state && panel) { panel.outerHTML = page.render(); }
        }
    }
    page.render = () => {
        if (app.state[key] !== null) { return '<div id="' + loadingId + '">' + render() + '</div>'; }

        const failed = failedState === app.state;
        return '<section id="' + loadingId + '" aria-busy="' + !failed + '"><h2>' + ui.esc(title) + '</h2><p' + (failed ? ' class="error"' : '') + '>' + ui.esc(failed ? error : '正在加载…') + '</p>' + (failed ? ui.btn('重试', loadingId) : '') + '</section>';
    };
    page.refresh = () => {
        if (app.state[key] !== null) { refresh?.(); } else if (failedState !== app.state) { void load(); }
    };
    page.action = async (a, id) => {
        if (a === loadingId) { await load(); } else { await action?.(a, id); }
    };
    return page;
}
function createSections(app, ui, title, entries) {
    let selected = Object.keys(entries)[0];
    const pages = {};
    const current = () => pages[selected] ??= entries[selected].create();
    function render() {
        return (
            (Object.keys(entries).length > 1 ? '<nav class="subnav" aria-label="' +
                ui.esc(title) +
                '">' +
                Object.entries(entries)
                    .map(
                        ([id, entry]) =>
                            '<button data-action="section" data-id="' +
                            ui.esc(id) +
                            '"' +
                            (id === selected ? ' aria-current="true" class="active"' : "") +
                            ">" +
                            ui.esc(entry.label) +
                            "</button>",
                    )
                    .join("") +
                "</nav>" : "") +
            current().render()
        );
    }
    async function action(a, id) {
        if (a === "section") {
            reset();
            selected = id;
            app.render();
            app.focus("app");
            return;
        }

        await current().action(a, id);
    }
    function reset() {
        for (const page of Object.values(pages)) {
            page.reset?.();
        }
    }
    return {
        get activeSection() { return selected; },
        get discardActions() { return current().discardActions || []; },
        get transientInputs() { return current().transientInputs || []; },
        render,
        refresh: () => current().refresh?.(),
        action,
        reset,
        input: (el) => current().input?.(el),
        change: (el) => current().change?.(el),
        focus: (el) => current().focus?.(el),
    };
}
`;
