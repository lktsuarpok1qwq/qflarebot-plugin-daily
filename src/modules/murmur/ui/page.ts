export const murmurPage = String.raw`
function createMurmurLibrary(app, ui) {
    const { $, esc, btn, table } = ui;
    let batchText = null, batchSynchronized = true;
    let items = null, next = null, pageCursor = 0, used = false, editing = null, original = null, synchronized = true, listVersion = 0;
    const restoreImages = createPreviewImages(() => $('murmurReadOnly'));
    const preview = createMessageEditor(app, ui, {
        id: 'murmurEntry', bodyLabel: '文案正文', context: () => String(editing?.id || 'new'),
        samples: () => [{ id: 'text', name: '无特殊情景', values: {} }],
        currentValue: () => $('murmurEntryBody').value,
        renderSample: (sample, mark) => [{ text: inlineCommandTools.expand(app.config.copy.today, {}, { text: mark($('murmurEntryBody').value) }) }],
        sampleHint: '当前文案套用公告格式，本地预览',
    });

    function checkedEntry(value, expected, saved = false) {
        if (!value || !Number.isSafeInteger(value.id) || value.id < 1 || !Number.isSafeInteger(value.revision) || value.revision < 1 || typeof value.text !== 'string'
            || !Number.isSafeInteger(value.position) || value.position < 1 || typeof value.locked !== 'boolean' || value.usedDay !== null && !/^\d{4}-\d{2}-\d{2}$/.test(value.usedDay) || value.locked && value.usedDay === null
            || expected?.id !== undefined && expected.id !== null && value.id !== expected.id
            || saved && (value.text !== expected.text || value.revision !== (expected.id === null ? 1 : expected.revision + 1))) {
            throw Error('文案响应无效，请重新加载');
        }

        return value;
    }

    function dirty() {
        return Boolean(batchText?.length || editing && !editing.locked && (original ? editing.text !== original.text : editing.text.length));
    }

    function invalidateList() {
        items = next = null;
        listVersion++;
    }

    function moveButton(row, direction, index) {
        const prior = direction === 'up', blocked = prior ? pageCursor === 0 && !items.slice(0, index).some(item => !item.locked)
            : next === null && !items.slice(index + 1).some(item => !item.locked);

        return btn(prior ? '上移' : '下移', 'murmur-' + direction, row.id).replace('<button', '<button id="murmur-' + direction + '-' + row.id + '"' + (blocked ? ' disabled data-locked' : ''));
    }

    function render() {
        let html = '<section>' + ui.sectionHeader('文案库', btn('添加文案', 'murmur-new', '', 'primary') + btn('批量录入', 'murmur-batch')) +
            '<p class="muted">每日一篇，新文案优先，用完按顺序循环 · 通知模板填写 <strong>{{絮语.今日}}</strong>，时间和对象在通知任务中设置</p>' +
            '<div class="actions"><label>显示<select id="murmurEntryStatus">' + ui.options([{ id: 'queued', name: '待使用' }, { id: 'used', name: '已选用' }], used ? 'used' : 'queued') + '</select></label>' + btn('查询', 'murmur-query').replace('<button', '<button id="murmurQuery"') + '</div>' +
            (items === null ? '<p class="muted">点击查询后查看文案库</p>' : table(['文案', '最近选用', '操作'], items.map((row, index) => '<tr><td>' + esc(row.excerpt) + '</td><td>' + esc(row.usedDay || '待使用') + '</td><td>' +
                btn(row.locked ? '查看' : '编辑', 'murmur-edit', row.id) + (row.locked ? '' : moveButton(row, 'up', index) + moveButton(row, 'down', index) + btn('删除', 'murmur-delete', row.id, 'danger')) + '</td></tr>'))) +
            (items && !items.length ? '<p class="muted">' + (used ? '暂无已选用文案' : '暂无待用文案，有已选用文案时会循环') + '</p>' : '') +
            (next !== null ? btn('下一页', 'murmur-next') : '') + '</section>';

        if (batchText !== null) {
            return html + '<section>' + ui.sectionHeader('批量录入', btn('关闭录入', 'murmur-close')) +
                '<p id="murmurBatchHint" class="muted">两篇之间另起一行填写 ===，正文空行原样保留 · 每批最多 100 篇，合计不超过 256 KB</p>' +
                '<label for="murmurBatchBody">文案正文</label><textarea id="murmurBatchBody" rows="12" aria-describedby="murmurBatchHint">' + esc(batchText) + '</textarea>' +
                '<p id="murmurBatchCount" class="muted"></p>' + (!batchSynchronized ? '<p class="notice">录入结果未确认，请重新加载后核对文案库</p>' : '') +
                '<div class="actions">' + btn('保存全部', 'murmur-batch-save', '', 'primary') + '</div></section>';
        }

        if (!editing) { return html; }

        html += '<section>' + ui.sectionHeader(editing.locked ? '查看文案' : editing.id ? '编辑文案' : '添加文案', btn('关闭编辑', 'murmur-close'));

        if (editing.locked) {
            return html + '<p class="muted">今天已选用，不可修改或删除 · 投递结果见通知记录</p><div id="murmurReadOnly" class="message-preview">' + ui.markdown(editing.text) + '</div></section>';
        }

        return html + (editing.usedDay ? '<p class="muted">最近选用 ' + esc(editing.usedDay) + ' · 今天选中的文案不可修改</p>' : '') +
            (!synchronized ? '<p class="notice">保存结果未确认，请重新加载后编辑</p>' : '') +
            preview.render([{ id: 'murmurEntryBody', label: '文案正文', value: editing.text, variables: {}, literal: true, allowEmpty: true }]) +
            '<div class="actions">' + btn('保存文案', 'murmur-save', '', 'primary') + btn('撤销修改', 'murmur-revert') + '</div></section>';
    }

    function batchParts() {
        return batchText === null || !batchText.length ? [] : batchText.split(/\r?\n===\r?\n/);
    }

    function refresh() {
        if (batchText !== null) {
            const parts = batchParts(), button = document.querySelector('[data-action="murmur-batch-save"]');
            $('murmurBatchCount').textContent = '将添加 ' + parts.length + ' 篇';

            if (button) {
                button.disabled = !batchText.length || !batchSynchronized;
                button.toggleAttribute('data-locked', button.disabled);
                button.setAttribute('data-managed-disabled', '');
            }
        }

        if (!editing) { return; }

        if (editing.locked) {
            restoreImages();

            return;
        }

        preview.refresh();

        for (const action of ['murmur-save', 'murmur-revert']) {
            const button = document.querySelector('[data-action="' + action + '"]');

            if (button) {
                const disabled = !dirty() || action === 'murmur-save' && !synchronized;
                button.disabled = disabled;
                button.toggleAttribute('data-locked', disabled);
                button.setAttribute('data-managed-disabled', '');
            }
        }
    }

    async function query(cursor = null) {
        if (cursor === null) {
            invalidateList();
            app.render();
        }

        const version = ++listVersion, filter = used;

        try {
            const value = await app.api('entries?status=' + (filter ? 'used' : 'queued') + (cursor !== null ? '&after=' + cursor : ''));

            if (version !== listVersion || filter !== used) { return; }

            if (!value || !Array.isArray(value.items) || value.next !== null && (!Number.isSafeInteger(value.next) || value.next < 1)
                || value.items.some(row => !Number.isSafeInteger(row.id) || row.id < 1 || !Number.isSafeInteger(row.revision) || row.revision < 1 || typeof row.excerpt !== 'string'
                    || !Number.isSafeInteger(row.position) || row.position < 1 || typeof row.locked !== 'boolean' || row.usedDay !== null && !/^\d{4}-\d{2}-\d{2}$/.test(row.usedDay) || row.locked && row.usedDay === null)) {
                throw Error('文案列表响应无效');
            }

            items = value.items;
            pageCursor = cursor ?? 0;
            next = value.next;
            app.render();
        } catch (error) {
            if (version !== listVersion || filter !== used) { return; }

            throw error;
        }
    }

    async function load() {
        await app.load(false);
        batchText = null;
        batchSynchronized = true;
        await query();
    }

    async function action(a, id) {
        if (editing && !editing.locked && await preview.action(a)) { return; }

        if (a === 'murmur-query') { await query(); }

        if (a === 'murmur-next' && next !== null) { await query(next); }

        if (a === 'murmur-batch') {
            editing = original = null;
            batchText = '';
            batchSynchronized = true;
            app.render();
            app.focus('murmurBatchBody');
        }

        if (a === 'murmur-batch-save' && batchText !== null && batchSynchronized) {
            const texts = batchParts();

            if (!texts.length || texts.length > 100 || texts.some(text => !text.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))
                || new TextEncoder().encode(JSON.stringify({ texts })).length > 256000) {
                ui.fieldError('murmurBatchBody', '请填写 1～100 篇非空正文，合计不超过 256 KB');
                app.focus('murmurBatchBody');

                return;
            }

            try {
                const result = await app.api('entries-add', { texts });

                if (!Array.isArray(result?.items) || result.items.length !== texts.length) { throw Error('批量录入结果未确认'); }

                const saved = [...result.items].sort((a, b) => a.position - b.position);

                saved.forEach((row, index) => checkedEntry(row, { id: null, revision: 0, text: texts[index] }, true));

                if (new Set(saved.map(row => row.id)).size !== texts.length) { throw Error('批量录入结果未确认'); }
            } catch (error) {
                if (error.kind !== 'validation') { batchSynchronized = false; }

                app.render();

                throw error;
            }

            batchText = null;
            invalidateList();
            app.render();
            app.status('已添加 ' + texts.length + ' 篇文案，点击查询查看');
        }

        if (a === 'murmur-up' || a === 'murmur-down') {
            const row = items?.find(item => item.id === Number(id));

            if (!row || row.locked) { return; }

            let changed;

            try {
                const result = await app.api('entry-move', { id: row.id, revision: row.revision, direction: a === 'murmur-up' ? 'up' : 'down' });

                if (!Array.isArray(result?.items) || result.items.length !== 2 || !result.items.some(item => item.id === row.id && item.revision === row.revision + 1)
                    || new Set(result.items.map(item => item.id)).size !== 2
                    || result.items.some(item => !Number.isSafeInteger(item.id) || item.id < 1 || !Number.isSafeInteger(item.revision) || item.revision < 1 || !Number.isSafeInteger(item.position) || item.position < 1
                        || items.some(saved => saved.id === item.id && item.revision !== saved.revision + 1))) { throw Error('顺序结果未确认，请重新查询'); }

                changed = result.items;
            } catch (error) {
                invalidateList();
                app.render();

                throw error;
            }

            if (changed.every(change => items.some(item => item.id === change.id))) {
                for (const change of changed) {
                    Object.assign(items.find(item => item.id === change.id), change);

                    if (editing?.id === change.id) {
                        Object.assign(editing, change);
                        Object.assign(original, change);
                    }
                }

                items.sort((a, b) => a.position - b.position);
            } else { invalidateList(); }

            app.render();
            const focus = 'murmur-' + (a === 'murmur-up' ? 'up' : 'down') + '-' + row.id;
            app.focus(!$(focus) ? 'murmurQuery' : $(focus).hasAttribute('data-locked') ? 'murmur-' + (a === 'murmur-up' ? 'down' : 'up') + '-' + row.id : focus);
            app.status(items ? '顺序已调整' : '顺序已调整，点击查询查看');
        }

        if (a === 'murmur-new' || a === 'murmur-edit') {
            batchText = null;

            if (!app.state) { await app.load(false); }

            editing = a === 'murmur-new' ? { id: null, revision: 0, text: '', usedDay: null, locked: false }
                : checkedEntry(await app.api('entry?id=' + encodeURIComponent(id)), { id: Number(id) });
            original = editing.id === null ? null : structuredClone(editing);
            synchronized = true;
            app.render();

            if (!editing.locked) { app.focus('murmurEntryBody'); }
        }

        if (a === 'murmur-close') {
            batchText = null;
            editing = original = null;
            app.render();
        }

        if (a === 'murmur-revert' && dirty()) {
            if (!await app.confirmAction('撤销当前文案的全部未保存修改？')) { return; }

            editing = original ? structuredClone(original) : { id: null, revision: 0, text: '', usedDay: null, locked: false };
            app.render();
        }

        if (a === 'murmur-save' && editing && !editing.locked && dirty() && synchronized) {
            if (!editing.text.trim()) {
                ui.fieldError('murmurEntryBody', '请输入絮语正文');

                return;
            }

            if (!preview.validate(true)) { return; }

            const submitted = structuredClone(editing), isNew = editing.id === null;

            try {
                editing = checkedEntry(await app.api('entry-save', { id: submitted.id, revision: submitted.revision, text: submitted.text }), submitted, true);
            } catch (error) {
                if (error.kind !== 'validation') {
                    synchronized = false;
                    invalidateList();
                    app.render();
                }

                throw error;
            }

            original = structuredClone(editing);
            const row = { id: editing.id, revision: editing.revision, position: editing.position, usedDay: editing.usedDay, locked: editing.locked, excerpt: [...editing.text].slice(0, 40).join('') };
            const existing = items?.findIndex(item => item.id === editing.id) ?? -1;

            if (existing >= 0) {
                if ((row.usedDay !== null) === used) { items[existing] = row; } else { items.splice(existing, 1); }
            } else if (isNew && !used && items && next === null) {
                if (items.length < 20) { items.push(row); } else { next = items[items.length - 1].position; }
            }

            app.render();
            app.status('文案已保存');
        }

        if (a === 'murmur-delete') {
            const row = items?.find(item => item.id === Number(id));

            if (!row || row.locked) { return; }

            if (!await app.confirmAction('删除这篇文案？')) { return; }

            try {
                if ((await app.api('entry-delete', { id: row.id, revision: row.revision }))?.ok !== true) { throw Error('删除结果未确认，请重新加载'); }
            } catch (error) {
                if (error.kind !== 'validation') {
                    if (editing?.id === row.id) { synchronized = false; }

                    invalidateList();
                    app.render();
                }

                throw error;
            }

            items = items.filter(item => item.id !== row.id);

            if (editing?.id === row.id) { editing = original = null; }

            app.render();
            app.status('文案已删除');
        }
    }

    return {
        render, refresh, load, action, isDirty: dirty,
        isNew: () => Boolean(editing && editing.id === null),
        remember: preview.remember,
        transientInputs: ['murmurEntryStatus', ...preview.transientInputs],
        discardActions: ['murmur-new', 'murmur-edit', 'murmur-close', 'murmur-delete', 'murmur-batch', 'murmur-up', 'murmur-down'],
        input(el) {
            if (el.id === 'murmurBatchBody') {
                batchText = el.value;
                refresh();
            }

            if (el.id === 'murmurEntryBody' && editing && !editing.locked) {
                editing.text = el.value;
                preview.input(el);
                refresh();
            }
        },
        change(el) {
            if (el.id === 'murmurEntryStatus') {
                const selected = el.value === 'used';

                if (selected !== used) {
                    used = selected;
                    invalidateList();
                    app.render();
                }
            } else { preview.change(el); }
        },
        reset(invalidate = true) {
            batchText = null;
            batchSynchronized = true;
            editing = original = null;
            synchronized = true;

            if (invalidate) { invalidateList(); }
        },
    };
}
`;
