export const markdownPreview = String.raw`
function createMarkdownPreview(ui) {
    const { $, markdown } = ui;
    let timer, activeId;
    const desktop = matchMedia("(min-width: 900px)");
    function eligible(el) {
        return (
            el?.matches("textarea") &&
            !el.closest("[hidden]") &&
            document.querySelector('[data-markdown-for="' + CSS.escape(el.id) + '"]')
        );
    }
    function place(el, panel) {
        const workspace = el.closest(".markdown-workspace");
        const toolbar = workspace.querySelector('[data-markdown-for="' + CSS.escape(el.id) + '"]');

        if (desktop.matches) {
            if (panel.parentElement !== workspace) {
                workspace.append(panel);
            }
        } else if (toolbar.nextElementSibling !== panel) {
            toolbar.after(panel);

            if (document.activeElement === el) {
                el.scrollIntoView({ block: "nearest" });
            }
        }
    }
    function paint(el) {
        const box = $("markdownPreview");

        if (!box || !eligible(el)) {
            return;
        }

        place(el, box.closest(".local-preview"));
        activeId = el.id;
        $("markdownPreviewLabel").textContent =
            [...(el.labels?.[0]?.childNodes || [])]
                .filter((node) => node.nodeType === 3)
                .map((node) => node.textContent)
                .join("")
                .trim() || "当前文案";
        box.innerHTML = el.value ? markdown(el.value) : '<span class="muted">暂无内容</span>';
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
    desktop.addEventListener("change", refresh);
    return { refresh, input, focus };
}
`;
