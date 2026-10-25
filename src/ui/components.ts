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

    function field(label, id, value = "", type = "text", readonly = false, constraints = {}) {
        return (
            "<label>" +
            label +
            '<input id="' +
            id +
            (readonly ? '" readonly type="' : '" type="') +
            type +
            '" value="' +
            esc(value) + '"' + fieldConstraints(constraints) + '></label>'
        );
    }

    function fieldConstraints(constraints) {
        return ['min', 'max', 'step', 'maxLength', 'pattern'].filter(key => constraints[key] !== undefined)
            .map(key => ' ' + key.toLowerCase() + '="' + esc(constraints[key]) + '"').join('') + (constraints.required ? ' required' : '')
            + (constraints.maxCodePoints !== undefined ? ' data-max-code-points="' + esc(constraints.maxCodePoints) + '"' : '');
    }

    function validateFields(ids) {
        for (const id of ids) {
            const input = $(id), validity = input.validity;
            let message = '';

            if (input.required && !input.value.trim()) { message = '请填写此项'; }
            else if (validity.badInput) { message = input.type === 'number' ? '请填写有效数字' : '请填写有效值'; }
            else if (validity.rangeUnderflow || validity.rangeOverflow) { message = '请填写 ' + (input.min || '不限') + '～' + (input.max || '不限') + ' 范围内的值'; }
            else if (validity.stepMismatch) { message = '数值精度不符合要求'; }
            else if (validity.patternMismatch || validity.typeMismatch || input.maxLength >= 0 && input.value.length > input.maxLength) { message = '格式或长度不符合要求'; }
            else if (input.dataset.maxCodePoints && ([...input.value].length > Number(input.dataset.maxCodePoints)
                || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(input.value))) { message = '格式或长度不符合要求'; }

            if (message) {
                const label = input.labels?.[0]?.textContent.trim();
                fieldError(id, (label ? label + '：' : '') + message);

                return id;
            }
        }

        return null;
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
        const draft = /^(?:save-|card-save$)/.test(action) ? 'save' : /^(?:cancel-|revert-|card-cancel$)/.test(action) ? 'discard' : '';

        return '<button class="' + cls + '" data-action="' + action + '" data-id="' + esc(id) + '"' + (draft ? ' data-draft-action="' + draft + '"' : '') + '>' + text + '</button>';
    }

    function clearFieldError(input) {
        const error = $(input.id + '-error');

        if (!error?.hasAttribute('data-field-feedback')) { return; }

        error.hidden = true;
        input.removeAttribute('aria-invalid');
        const ids = (input.getAttribute('aria-describedby') || '').split(' ').filter(id => id && id !== error.id);
        input.setAttribute('aria-describedby', ids.join(' '));
    }

    function fieldError(id, message) {
        const input = typeof id === 'string' ? $(id) : id;
        let error = $(input.id + '-error');

        if (!error) {
            error = document.createElement('p');
            error.id = input.id + '-error';
            error.className = 'field-error';
            error.setAttribute('role', 'status');
            error.setAttribute('data-field-feedback', '');
            (input.closest('.setting-field') || input.closest('label') || input.parentElement).append(error);
        }

        error.textContent = message;
        error.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', [...new Set((input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean).concat(error.id))].join(' '));
        input.focus({ preventScroll: true });
    }

    function sectionHeader(title, actions) {
        return '<div class="section-header"><h2>' + esc(title) + '</h2><div class="actions">' + actions + '</div></div>';
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

    const markdown = (text, markers) => renderQQMarkdown(text, markers);

    const messageImages = new Map();

    function showMessage(id, result) {
        const el = $(id);
        el.hidden = false;
        el.innerHTML = markdown(result.text);

        if (!messageImages.has(id)) { messageImages.set(id, createPreviewImages(() => $(id))); }

        messageImages.get(id)();
    }

    const toolbar = (id) => '<div class="actions" data-markdown-for="' + esc(id) + '" role="group" aria-label="Markdown 格式">' +
        [['一级标题', '# ', '', '标题'], ['二级标题', '## ', '', '标题'], ['加粗', '**', '**', '文字'], ['斜体', '*', '*', '文字'], ['粗斜体', '***', '***', '文字'], ['删除线', '~~', '~~', '文字'], ['引用', '> ', '', '引用内容'], ['无序列表', '- ', '', '列表项'], ['有序列表', '1. ', '', '列表项'], ['嵌套列表', '    - ', '', '列表项'], ['链接', '[', '](https://example.com)', '链接文字'], ['图片', '![', '](https://example.com/image.png)', '图片说明'], ['分割线', '\n***\n', '', '']]
            .map(([label, before, after, fallback]) => btn(label, 'markup', JSON.stringify({ id, before, after, fallback, line: ['一级标题', '二级标题', '引用', '无序列表', '有序列表', '嵌套列表'].includes(label) }))).join('') + '</div>';

    function variableReference(groups, descriptions, sections, compositions = {}, target = "") {
        const names = [...new Set(groups.flatMap((group) => group.variables))];
        const composition = (name) => {
            const info = compositions[name];

            if (!info) { return ''; }

            return '<details class="variable-composition"><summary>查看组成</summary><p>' + esc(info.description) + '</p><p class="muted">' + esc(info.scope) + '</p><dl>' +
                Object.entries(info.fields).map(([key, description]) => '<dt><code>' + esc('{{' + key + '}}') + '</code></dt><dd>' + esc(description) + '</dd>').join('') + '</dl></details>';
        };
        const rows = (variables) => variables.filter(name => names.includes(name)).map((name, index) => {
            const help = target + '-variable-' + names.indexOf(name);

            return '<div class="variable-row">' + (target ? '<button data-action="insert-variable" data-id="' + esc(JSON.stringify({ id: target, value: '{{' + name + '}}' })) + '" aria-describedby="' + esc(help) + '">' + esc('{{' + name + '}}') + '</button>' : '<code>' + esc('{{' + name + '}}') + '</code>') +
                '<span class="hint" id="' + esc(help) + '">' + esc(descriptions[name]) + '</span>' + composition(name) + '</div>';
        }).join('');

        return '<div class="variable-reference"><h3>当前位置可用变量</h3>' + (names.length
            ? (sections || [{ label: '', variables: names }]).map(section => {
                const content = rows(section.variables);

                return content ? (section.label ? '<h4>' + esc(section.label) + '</h4>' : '') + '<div class="variable-grid">' + content + '</div>' : '';
            }).join('') : '<p class="muted">此模板没有可用变量</p>') + '</div>';
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
        sectionHeader,
        markdown,
        showMessage,
        toolbar,
        variableReference,
        fieldError,
        fieldConstraints,
        validateFields,
        clearFieldError,
        put,
        mergeDraft,
    };
}
`;
