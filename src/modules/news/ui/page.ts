export const newsPage = String.raw`
function createNewsCache(app, ui) {
    let selected = '', pending = null, failedState = null, error = '';
    async function load() {
        const state = app.state;

        if (state.cache || pending === state) { return; }

        pending = state;
        error = '';

        try {
            const result = await app.api('cache', {});

            if (app.state === state) { state.cache = result.cache; }
        } catch (cause) {
            if (app.state === state) { failedState = state; error = cause.message; }
        } finally {
            if (pending === state) { pending = null; }

            if (app.state === state && app.page === app.id) { app.render(); }
        }
    }
    function render() {
        if (!app.state.cache) {
            const failed = failedState === app.state;
            return '<section><h2>游戏缓存</h2><p' + (failed ? ' class="error"' : '') + '>' + ui.esc(failed ? error : '正在加载缓存…') + '</p>' + (failed ? ui.btn('重试', 'news-cache-load') : '') + '</section>';
        }

        const cache = app.state.cache;
        const format = (time) => time ? new Date(time + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ') : '尚未采集';
        const sources = Object.fromEntries(cache.map((row) => [row.source, app.state.settings.fields.find((field) => field.key === row.source)?.label || row.source]));
        return '<section><h2>游戏缓存</h2><p>游戏资讯每小时更新，命令和公告共用；按发布时间排序，最多保留三个自然日</p><div class="actions">' + ui.btn('立即采集', 'news-refresh', '', 'primary') + '</div>' +
            cache.map((row) => '<p><strong>' + ui.esc(sources[row.source]) + '</strong> · ' + (app.config[row.source] ? '已启用' : '已停用') + ' · ' + row.entries.length + ' 条<br><small>最近检查 ' + format(row.checked) + ' · 最近成功 ' + format(row.succeeded) + '</small>' + (row.error ? '<br><span class="error">' + ui.esc(row.error) + '</span>' : '') + '</p>').join('') +
            '<label>查看来源<select id="news-cache-source">' + ui.options([{ id: '', name: '全部来源' }, ...Object.entries(sources).map(([id, name]) => ({ id, name }))], selected) + '</select></label>' +
            cache.filter((row) => !selected || selected === row.source).map((row) => '<details><summary>' + ui.esc(sources[row.source]) + '</summary>' + row.entries.map((item) => '<p><a href="' + ui.esc(item.url) + '" target="_blank" rel="noopener noreferrer">' + ui.esc(item.title) + '</a><br><small>' + format(item.published) + ' · ' + ui.esc(item.rejected || (item.game ? '订阅：' + item.game : '发现')) + '</small></p>').join('') + '</details>').join('') +
            (!cache.some((row) => row.entries.length) ? '<p>暂无新闻，点击“立即采集”获取</p>' : '') + '</section>';
    }
    return {
        render, refresh() {
            if (!app.state.cache && pending !== app.state && failedState !== app.state) { void load(); }
        }, transientInputs: ['news-cache-source'], change(el) { if (el.id === 'news-cache-source') { selected = el.value; app.render(); } }, async action(action) {
            if (action === 'news-cache-load') { failedState = null; await load(); return; }

            if (action !== 'news-refresh') { return; }

            const result = await app.api('refresh', {});
            app.state.cache = result.cache;
            app.render();
            app.status('采集完成，请查看各来源状态');
        }
    };
}
function createNewsCopyEditor(app, ui) {
    return createCopyEditor(app, ui, app.id, {
        renderSample(sample, config, key, mark, view) {
            if (view.id === 'search') {
                return [{ text: renderSearchSample(config.search, sample.search, inlineCommandTools.expand, (field, value) => 'search' + field === key ? mark(value) : value) }];
            }

            const document = structuredClone(sample.document);

            if (document.kind === 'list') {
                if (view.id === 'latest') {
                    document.mode = '最新';
                    document.groups = [{ key: 'latest', items: document.groups.flatMap((group) => group.items) }];
                } else if (view.id === 'subscribed' || view.id === 'discovery') {
                    document.mode = view.id === 'subscribed' ? '订阅' : '发现';
                    document.groups = document.groups.filter((group) => group.key === view.id);
                }
            }

            return [{ text: renderNewsSample(config.copy, document, inlineCommandTools.expand, inlineCommandTools.url, (field, value) => field === key ? mark(value) : value) }];
        }
    });
}
`;
