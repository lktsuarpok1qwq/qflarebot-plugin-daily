export const weatherSettings = String.raw`
function createWeatherSettings(app, ui) {
    const { $, esc, btn, field, check } = ui;
    let drafts = {};
    function render() {
        return (
            "<section><h2>和风天气</h2><p>在和风控制台创建 API Key，在控制台设置中复制账号专属 API Host</p>" +
            '<p><a href="https://console.qweather.com" target="_blank" rel="noopener noreferrer">打开和风控制台</a></p><div class="grid">' +
            field("API Host", "weatherHost", drafts.host ?? app.config.host) +
            '<label>API Key<input id="weatherKey" type="password" autocomplete="new-password" value="' +
            esc(drafts.apiKey || "") +
            '" placeholder="' +
            (app.state.hasKey ? "已保存，留空保留" : "填写 API Key") +
            '"></label></div>' +
            "<small>API Host 为账号专属域名，例如 h2a9cf3mhs.xy.qweatherapi.com</small>" +
            check("清除已保存密钥", "weatherClearKey", drafts.clearKey || false) +
            '<p class="muted">密钥不回显、不导出到备份</p><div class="actions">' +
            btn("保存", "save-weather-settings", "", "primary") +
            btn("取消", "cancel-weather-settings") +
            btn("测试连接", "test-weather-api") +
            '</div><p id="weatherConnectionResult" role="status" class="muted">使用当前填写的凭证测试城市搜索、实况和预报，不保存、不发送</p></section>' +
            '<section><h2>查询用法</h2><p><strong>/天气 北京</strong> · 当前天气与今天预报</p><p><strong>/天气 悉尼 明天</strong> · 明天预报</p><p>每次查询直接获取数据，日期按查询地点计算</p><p class="muted">保存后，可在文案页手动预览查询结果</p></section>'
        );
    }
    function candidate() {
        const config = structuredClone(app.config);

        if (Object.hasOwn(drafts, "host")) {
            config.host = drafts.host.trim();
        }

        config.apiKey = drafts.clearKey ? null : (drafts.apiKey || "").trim();
        return config;
    }
    async function action(a) {
        if (a === "cancel-weather-settings") {
            app.render();
            return;
        }

        if (a === "test-weather-api") {
            const result = $("weatherConnectionResult");
            result.textContent = "正在测试连接…";
            result.className = "muted";

            try {
                const response = await app.api("test", { config: candidate() });
                result.textContent = response.message;
            } catch (error) {
                result.textContent = error.message;
                result.className = "error";
            }

            return;
        }

        if (a !== "save-weather-settings") {
            return;
        }

        const config = candidate();
        app.config = config;

        try {
            await app.save();
        } catch (error) {
            app.render();
            throw error;
        }

        drafts = {};
        app.render();
    }
    function edit(el) {
        if (["weatherHost", "weatherKey", "weatherClearKey"].includes(el.id)) {
            $("weatherConnectionResult").textContent = "凭证已修改，请重新测试";
            $("weatherConnectionResult").className = "muted";
        }

        if (el.id === "weatherHost") {
            drafts.host = el.value;
        } else if (el.id === "weatherKey") {
            drafts.apiKey = el.value;
        } else if (el.id === "weatherClearKey") {
            drafts.clearKey = el.checked;
        }
    }
    return {
        render,
        action,
        discardActions: ["cancel-weather-settings"],
        input: edit,
        change: edit,
        reset: () => {
            drafts = {};
        },
    };
}
`;
