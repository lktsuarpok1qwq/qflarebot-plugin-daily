export const sections = String.raw`
function createSections(app, ui, title, entries) {
    let selected = Object.keys(entries)[0];
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
            entries[selected].page.render()
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

        await entries[selected].page.action(a, id);
    }
    function reset() {
        for (const entry of Object.values(entries)) {
            entry.page.reset?.();
        }
    }
    return {
        get discardActions() { return Object.values(entries).flatMap((entry) => entry.page.discardActions || []); },
        get transientInputs() { return Object.values(entries).flatMap((entry) => entry.page.transientInputs || []); },
        render,
        refresh: () => entries[selected].page.refresh?.(),
        action,
        reset,
        input: (el) => entries[selected].page.input?.(el),
        change: (el) => entries[selected].page.change?.(el),
        focus: (el) => entries[selected].page.focus?.(el),
    };
}
`;
