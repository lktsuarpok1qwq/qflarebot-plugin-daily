export const markdownPreview = String.raw`
function createMarkdownPreview(ui, afterPaint) {
    const { $, markdown } = ui;
    let timer, activeId;
    let observed;
    const observer = new ResizeObserver(([entry]) => {
        const workspace = entry.target.closest('.markdown-workspace');
        const height = entry.target.getBoundingClientRect().height;

        if (workspace && height > 0) { workspace.style.setProperty('--editor-height', height + 'px'); }
    });

    function eligible(el) {
        return el?.matches('textarea') && !el.closest('[hidden]') && document.querySelector('[data-markdown-for="' + CSS.escape(el.id) + '"]');
    }

    function observe(el) {
        if (observed === el) { return; }

        observer.disconnect();
        observed = el;
        observer.observe(el);
        el.closest('.markdown-workspace').style.setProperty('--editor-height', el.getBoundingClientRect().height + 'px');
    }

    function paint(el) {
        const box = $("markdownPreview");

        if (!box || !eligible(el)) {
            return;
        }

        observe(el);
        activeId = el.id;
        $("markdownPreviewLabel").textContent =
            [...(el.labels?.[0]?.childNodes || [])]
                .filter((node) => node.nodeType === 3)
                .map((node) => node.textContent)
                .join("")
                .trim() || "当前文案";

        if (box.closest("[hidden]")) { return; }

        box.innerHTML = el.value ? markdown(el.value) : '<span class="muted">暂无内容</span>';
        afterPaint();
    }

    function refresh() {
        clearTimeout(timer);
        const el = $(activeId) || null;
        paint(eligible(el) ? el : [...document.querySelectorAll("#app textarea")].find(eligible));
    }

    function input(el) {
        if (!eligible(el)) {
            return;
        }

        activeId = el.id;
        clearTimeout(timer);

        if ($("markdownPreview")?.closest("[hidden]")) { return; }

        timer = setTimeout(() => {
            if (el.isConnected && eligible(el)) {
                paint(el);
            }
        }, 200);
    }

    function focus(el) {
        if (eligible(el) && activeId !== el.id) {
            clearTimeout(timer);
            paint(el);
        }
    }

    return { refresh, input, focus };
}
`;
