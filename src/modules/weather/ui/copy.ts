export const weatherCopyPage = String.raw`
function createWeatherCopyPage(app, ui) {
    const { $, esc, btn, toolbar, showMessage } = ui;
    let selected = "current",
        drafts = {},
        query = "";
    function variables() {
        const all = new Map();

        for (const field of Object.values(app.state.fields)) {
            for (const [key, description] of Object.entries(field.variables)) {
                const entry = all.get(key) || { descriptions: new Set(), uses: [] };
                entry.descriptions.add(description);
                entry.uses.push(field.label);
                all.set(key, entry);
            }
        }

        return (
            '<h3>全部文案参数</h3><p class="muted">仅限对应文案使用，当前分类可用项已标注</p>' +
            ui.table(
                ["参数", "说明", "适用文案"],
                [...all].map(
                    ([key, entry]) =>
                        "<tr><td><code>{{" +
                        esc(key) +
                        "}}</code>" +
                        (Object.hasOwn(app.state.fields[selected].variables, key) ? "<small>当前可用</small>" : "") +
                        "</td><td>" +
                        [...entry.descriptions].map(esc).join(" / ") +
                        "</td><td>" +
                        entry.uses.map((label) => "<strong>" + esc(label) + "</strong>").join("<br>") +
                        "</td></tr>",
                ),
            )
        );
    }

    function render() {
        return (
            '<section><h2>天气文案</h2><label>分类<select id="weatherCopyCategory">' +
            ui.options(
                Object.entries(app.state.fields).map(([id, field]) => ({ id, name: field.label })),
                selected,
            ) +
            "</select></label>" +
            "<p>用于 <strong>" +
            esc(app.state.fields[selected].label) +
            '</strong>，天气结果自动附带数据来源</p><div class="markdown-workspace"><div class="markdown-editor"><label for="weatherCopyBody">回复文案</label><textarea id="weatherCopyBody">' +
            esc(drafts[selected] ?? app.config.copy[selected]) +
            "</textarea>" +
            toolbar("weatherCopyBody") +
            "</div>" +
            ui.previewPanel() +
            '</div><div id="weatherVariables">' +
            variables() +
            '</div><div class="actions">' +
            btn("保存全部修改", "save-weather-copy", "", "primary") +
            btn("恢复默认", "reset-weather-copy") +
            btn("取消", "cancel-weather-copy") +
            "</div></section>" +
            '<section><h2>实际预览</h2><label>命令参数<input id="weatherQuery" value="' +
            esc(query) +
            '" placeholder="北京 或 悉尼 明天；留空查看帮助"></label><p id="weatherPreviewHint" class="muted">使用当前文案查询，不发送消息</p>' +
            btn("预览", "preview-weather") +
            '<div id="weatherPreviewResult" hidden><h3 id="weatherPreviewCommand"></h3><div id="weatherPreview" class="message-preview"></div></div></section>'
        );
    }
    function candidate() {
        const config = structuredClone(app.config);
        Object.assign(config.copy, drafts);
        return config;
    }
    function invalidate() {
        $("weatherPreviewResult").hidden = true;
        $("weatherPreviewHint").textContent = "内容已变化，请重新预览";
    }
    async function action(a) {
        if (a === "cancel-weather-copy") {
            app.render();
            return;
        }

        if (a === "save-weather-copy") {
            app.config = candidate();

            try {
                await app.save();
            } catch (error) {
                app.render();
                throw error;
            }

            drafts = {};
            app.render();
        } else if (a === "reset-weather-copy") {
            if (!(await app.confirmAction("恢复当前文案？保存后生效"))) {
                return;
            }

            drafts[selected] = app.state.defaults[selected];
            app.dirty = true;
            app.render();
        } else if (a === "preview-weather") {
            invalidate();

            try {
                const result = await app.api("preview", { config: candidate(), query });
                $("weatherPreviewCommand").textContent = "命令回复 · /天气" + (query.trim() ? " " + query.trim() : "");
                showMessage("weatherPreview", result);
                $("weatherPreviewResult").hidden = false;
                $("weatherPreviewHint").textContent = "本次查询结果，不发送消息";
            } catch (error) {
                $("weatherPreviewHint").textContent = "预览失败，请重试";
                throw error;
            }
        }
    }
    function input(el) {
        if (el.id === "weatherCopyBody") {
            drafts[selected] = el.value;
            invalidate();
        } else if (el.id === "weatherQuery") {
            query = el.value;
            invalidate();
        }
    }
    function change(el) {
        if (el.id === "weatherCopyCategory") {
            selected = el.value;

            if (selected === "help") {
                query = "";
            } else if (selected === "current") {
                query = query.replace(/\s+明天$/, "");
            } else if (selected === "tomorrow" && query.trim() && !/\s+明天$/.test(query.trim())) {
                query = query.trim() + " 明天";
            }

            app.render();
        }
    }
    return {
        render,
        action,
        input,
        change,
        discardActions: ["cancel-weather-copy"],
        transientInputs: ["weatherCopyCategory", "weatherQuery"],
        reset: () => {
            drafts = {};
        },
    };
}
`;
