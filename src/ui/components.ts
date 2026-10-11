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
        return (
            '<div class="table"><table><thead><tr>' +
            head.map((h) => "<th>" + h + "</th>").join("") +
            "</tr></thead><tbody>" +
            rows.join("") +
            "</tbody></table></div>"
        );
    }
    function markdown(text) {
        const inline = (line) => {
            const literals = [];
            const hold = (html) => "\u0000" + (literals.push(html) - 1) + "\u0000";
            return esc(line.replace(/\\([\\\x60*_{}[\]()<>#+.!|~-])/g, (_, c) => hold(esc(c))))
                .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) =>
                    hold('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + "</a>"),
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
                if (/^---+$/.test(line)) {
                    return "<hr>";
                }

                const heading = line.match(/^(#{1,2})\s+(.*)/);

                if (heading) {
                    return "<h" + heading[1].length + ">" + inline(heading[2]) + "</h" + heading[1].length + ">";
                }

                if (/^>\s?/.test(line)) {
                    return "<blockquote>" + inline(line.replace(/^>\s?/, "")) + "</blockquote>";
                }

                if (/^[-*]\s+/.test(line)) {
                    return "<ul><li>" + inline(line.replace(/^[-*]\s+/, "")) + "</li></ul>";
                }

                if (/^\d+\.\s+/.test(line)) {
                    return "<ol><li>" + inline(line.replace(/^\d+\.\s+/, "")) + "</li></ol>";
                }

                return "<div>" + inline(line || " ") + "</div>";
            })
            .join("");
    }
    function showMessage(id, result) {
        const el = $(id);
        el.hidden = false;
        el.innerHTML = markdown(result.text);
    }
    const toolbar = (id) =>
        '<div class="actions">' +
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
    const put = (list, item) => {
        const i = list.findIndex((x) => x.id === item.id);

        if (i < 0) {
            list.push(item);
        } else {
            list[i] = item;
        }
    };
    return { $, esc, uid, time, options, field, check, btn, table, markdown, showMessage, toolbar, put };
}
`;
