export const components = String.raw`
function createUI() {
    const $ = (id) => document.getElementById(id),
        esc = (s) =>
            String(s ?? "").replace(
                /[&<>"']/g,
                (c) =>
                    ({
                        "&": "&amp;",
                        "<": "&lt;",
                        ">": "&gt;",
                        '"': "&quot;",
                        "'": "&#39;",
                    })[c],
            ),
        uid = () => crypto.randomUUID();

    const time = (n) =>
        n
            ? new Date(n).toLocaleString("zh-CN", {
                timeZone: "Asia/Shanghai",
                hour12: false,
            })
            : "无未来计划";
    function options(items, selected) {
        return items
            .map(
                (x) =>
                    '<option value="' +
                    esc(x.id) +
                    '" ' +
                    ((Array.isArray(selected) ? selected.includes(x.id) : selected === x.id) ? "selected" : "") +
                    ">" +
                    esc(x.name || x.id) +
                    "</option>",
            )
            .join("");
    }
    function field(label, id, value = "", type = "text", readonly = false) {
        return (
            "<label>" +
            label +
            '<input id="' +
            id +
            (readonly ? '" readonly type="' : '" type="') +
            type +
            '" value="' +
            esc(value) +
            '"></label>'
        );
    }
    function check(label, id, value) {
        return (
            '<label class="check"><input id="' +
            id +
            '" type="checkbox" ' +
            (value ? "checked" : "") +
            ">" +
            label +
            "</label>"
        );
    }
    function btn(text, action, id = "", cls = "") {
        return (
            '<button class="' + cls + '" data-action="' + action + '" data-id="' + esc(id) + '">' + text + "</button>"
        );
    }
    function table(head, rows) {
        const content = rows
            .map((row) => {
                let column = 0;
                return row.replace(/<td>([\s\S]*?)<\/td>/g, (_, value) => {
                    const label = head[column++];
                    return (
                        '<td data-label="' +
                        esc(label) +
                        '"><div' +
                        (label === "操作" ? ' class="row-actions"' : "") +
                        ">" +
                        value +
                        "</div></td>"
                    );
                });
            })
            .join("");
        return (
            '<div class="table"><table><thead><tr>' +
            head.map((h) => '<th scope="col">' + esc(h) + "</th>").join("") +
            "</tr></thead><tbody>" +
            (content || '<tr><td class="empty" colspan="' + head.length + '">暂无记录</td></tr>') +
            "</tbody></table></div>"
        );
    }
    function markdown(text, markers) {
        const inline = (line) => {
            if (markers) {
                line = line.replace(/\[([^\]]*)\]\(([^)\n]*)\)/g, (link, label, url) => {
                    const start = url.includes(markers.start), end = url.includes(markers.end);

                    if (!start && !end) { return link; }

                    const clean = url.split(markers.start).join('').split(markers.end).join('');
                    return (start ? markers.start : '') + '[' + label + '](' + clean + ')' + (end ? markers.end : '');
                });
            }

            const literals = [];
            const hold = (html) => "\u0000" + (literals.push(html) - 1) + "\u0000";
            const restore = (text) => text.replace(/\u0000(\d+)\u0000/g, (_, index) => literals[Number(index)] || "");
            return esc(line.replace(/\\([\\\x60*_{}[\]()<>#+.!|~-])/g, (_, c) => hold(esc(c))))
                .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mqqapi:\/\/aio\/inlinecmd\?[^\s)]+)\)/g, (_, label, url) =>
                    hold('<a href="' + restore(url) + '" target="_blank" rel="noopener noreferrer">' + restore(label) + "</a>"),
                )
                .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
                .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
                .replace(/\*([^*]+)\*/g, "<em>$1</em>")
                .replace(/~~([^~]+)~~/g, "<del>$1</del>")
                .replace(/\u0000(\d+)\u0000/g, (_, index) => literals[Number(index)] || "");
        };
        return text
            .split("\n")
            .map((line) => {
                let prefix = '';

                if (markers) {
                    // Move leading provenance tokens past block syntax without changing the Markdown.
                    while (line.startsWith(markers.start) || line.startsWith(markers.end)) {
                        const token = line.startsWith(markers.start) ? markers.start : markers.end;
                        prefix += token; line = line.slice(token.length);
                    }
                }

                const content = (value) => inline(prefix + value);

                if (/^---+$/.test(line)) {
                    return content("") + "<hr>";
                }

                const heading = line.match(/^(#{1,2})\s+(.*)/);

                if (heading) {
                    return "<h" + heading[1].length + ">" + content(heading[2]) + "</h" + heading[1].length + ">";
                }

                if (/^>\s?/.test(line)) {
                    return "<blockquote>" + content(line.replace(/^>\s?/, "")) + "</blockquote>";
                }

                if (/^[-*]\s+/.test(line)) {
                    return "<ul><li>" + content(line.replace(/^[-*]\s+/, "")) + "</li></ul>";
                }

                if (/^\d+\.\s+/.test(line)) {
                    return "<ol><li>" + content(line.replace(/^\d+\.\s+/, "")) + "</li></ol>";
                }

                return "<div>" + content(line || " ") + "</div>";
            })
            .join("");
    }
    function showMessage(id, result) {
        const el = $(id);
        el.hidden = false;
        el.innerHTML = markdown(result.text);
    }
    const toolbar = (id) =>
        '<div class="actions" data-markdown-for="' +
        esc(id) +
        '" role="group" aria-label="Markdown 格式"><span class="muted">Markdown</span>' +
        [
            ["标题", "# ", ""],
            ["加粗", "**", "**"],
            ["斜体", "*", "*"],
            ["删除线", "~~", "~~"],
            ["链接", "[", "](https://example.com)"],
            ["列表", "- ", ""],
            ["引用", "> ", ""],
        ]
            .map(([label, before, after]) => btn(label, "markup", JSON.stringify({ id, before, after })))
            .join("") +
        "</div>";
    function variableReference(groups, descriptions, sections, compositions = {}) {
        const names = [...new Set(groups.flatMap((group) => group.variables))];
        const composition = (name) => {
            const info = compositions[name];

            if (!info) { return ''; }

            return '<details class="variable-composition"><summary>查看组成</summary><p>' + esc(info.description) + '</p><p class="muted">' + esc(info.scope) + '</p><dl>' +
                Object.entries(info.fields).map(([key, description]) => '<dt><code>' + esc('{{' + key + '}}') + '</code></dt><dd>' + esc(description) + '</dd>').join('') + '</dl></details>';
        };
        const rows = (variables) =>
            variables
                .filter((name) => names.includes(name))
                .map(
                    (name) =>
                        "<tr><td><code>" +
                        esc("{{" + name + "}}") +
                        "</code></td><td>" +
                        esc(descriptions[name]) + composition(name) +
                        "</td></tr>",
                );
        return (
            '<div class="variable-reference"><h3>当前位置可用变量</h3>' +
            (names.length
                ? (sections || [{ label: "", variables: names }])
                    .map((section) => {
                        const content = rows(section.variables);
                        return content.length
                            ? (section.label ? "<h4>" + esc(section.label) + "</h4>" : "") +
                            table(["变量", "说明"], content)
                            : "";
                    })
                    .join("")
                : '<p class="muted">当前文案不支持变量</p>') +
            "</div>"
        );
    }

    function mergeDraft(current, original, draft) {
        if (!original) {
            return structuredClone(draft);
        }

        if (!current) {
            throw Error("条目已被删除，请刷新后重新编辑");
        }

        const merged = structuredClone(current);

        for (const [key, value] of Object.entries(draft)) {
            if (JSON.stringify(value) === JSON.stringify(original[key])) {
                continue;
            }

            merged[key] = value && typeof value === "object" && !Array.isArray(value) && value.kind === original[key]?.kind
                ? mergeDraft(current[key], original[key], value)
                : structuredClone(value);
        }

        return merged;
    }
    const put = (list, item) => {
        const i = list.findIndex((x) => x.id === item.id);

        if (i < 0) {
            list.push(item);
        } else {
            list[i] = item;
        }
    };
    return {
        $,
        esc,
        uid,
        time,
        options,
        field,
        check,
        btn,
        table,
        markdown,
        showMessage,
        toolbar,
        variableReference,
        put,
        mergeDraft,
    };
}
`;
