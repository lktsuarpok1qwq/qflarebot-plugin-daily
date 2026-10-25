import { cardCanvas } from "./canvas.js";
import { cardResources } from "./resources.js";
import { createTextLayout, layoutCard, emojiURL } from "../../cards/layout.js";
import { validateRegionContent } from "../../cards/validation.js";
import metrics from "../../cards/metrics.json";
import { fontAsset } from "../../cards/types.js";
import { cardStateValidation } from "./validation.js";

export const cardEditor = `const cardWidths = ${JSON.stringify(metrics)};\nconst validateRegionContent = ${validateRegionContent.toString()};\nconst createTextLayout = ${createTextLayout.toString()};
const layoutCard = ${layoutCard.toString()};\nconst cardEmojiURL = ${emojiURL.toString()};\nconst cardFontNames = ${JSON.stringify({ 400: fontAsset(400), 700: fontAsset(700) })};\n` + cardStateValidation + String.raw`
function createCardEditor(app, ui) {
    let state = null, draft = null, selected = '', regionId = '', loading = false, failure = '', generation = 0, loadedRevision;
    let realURL = '', realStale = false, background = null, backgroundAsset = '', backgroundPending = null, imageToken = 0, synchronized = true;

    const sprites = new Map(), fontLoads = new Map(), fonts = new Set(), failedFonts = new Set(), samples = {}, sampleIds = {}, pending = new Map();

    const assetURL = asset => state.assets[asset]?.url || new URL('../cards/assets/' + asset, location.href).href;
    const definition = () => state.definitions.find(item => item.id === selected);
    const design = () => draft[selected];
    const region = () => design().regions.find(item => item.id === regionId);
    const values = () => ({ ...Object.fromEntries(definition().fields.map(field => [field.key, field.sample])), ...(definition().samples.find(s => s.id === sampleIds[selected]) || definition().samples[0]).values, ...samples[selected] });
    const esc = ui.esc;

    async function request(action, data, raw = false) {
        const response = await app.resource('/api/cards/' + app.id + '/' + action, data === undefined ? {} : { method: 'POST', headers: { 'content-type': raw ? 'image/png' : 'application/json' }, body: raw ? data : JSON.stringify(data) });

        if (!response.ok) {
            const error = await response.json();
            throw Object.assign(Error(error.error || '请求失败'), { kind: error.kind });
        }

        return response;
    }

    function applyModule(module, definitions = state.definitions) {
        checkCardDesigns(module, definitions);
        const checked = app.checkedState(module);
        const config = { ...module.config };

        // revision 为零表示尚未保存的默认草稿，不属于模块配置
        if (config.cardDesigns.revision === 0) { delete config.cardDesigns; }

        app.state = { ...checked, config };
        app.config = structuredClone(config);
        app.synchronized = true;
    }

    async function load() {
        if (loading || state) { return; }

        loading = true;
        const current = generation;
        app.render();

        try {
            const result = checkCardState(await (await request('state')).json());

            if (current !== generation) { return; }

            applyModule(result.module, result.definitions);
            state = result;
            loadedRevision = result.module.revision;
            draft = structuredClone(result.module.config.cardDesigns.config);
            selected ||= result.definitions[0].id;
            regionId = draft[selected].regions[0]?.id || '';
            failure = '';
            synchronized = true;
        } catch (error) { if (current === generation) { failure = error.message; } }
        finally {
            if (current === generation) {
                loading = false;

                if (ui.$('card-editor')) { app.render(); }
            }
        }
    }

    function options(items, value) { return items.map(([id, label]) => '<option value="' + esc(id) + '"' + (id === String(value) ? ' selected' : '') + '>' + esc(label) + '</option>').join(''); }

    function field(key, label, value, type = 'number', extra = '') { return '<label>' + label + '<input id="card-' + key + '" type="' + type + '" value="' + esc(value) + '" ' + extra + '></label>'; }

    function render() {
        if (!state) { return '<section id="card-editor"><p role="status">' + esc(failure || (loading ? '正在加载卡面…' : '尚未加载卡面')) + '</p>' + (loading ? '<div class="skeleton-line"></div><div class="skeleton-line"></div>' : '') + '</section>'; }

        const d = definition(), c = design(), r = region();

        return '<section id="card-editor"><div class="card-toolbar"><label>编辑卡面<select id="card-kind">' + options(state.definitions.map(item => [item.id, item.title]), selected) + '</select></label></div>' +
            '<p class="muted">' + d.width + ' × ' + d.height + ' · 在图片上拖出区域，拖动区域移动，拖动右下角缩放</p>' +
            '<div class="card-editor-grid"><div class="card-editor-controls"><fieldset class="card-features"><legend>功能开关</legend><label class="check card-toggle"><input id="card-enabled" type="checkbox"' + (c.enabled ? ' checked' : '') + '>使用自定义卡面</label></fieldset><div class="card-control-group"><h3>背景与字体</h3>' +
            '<label>内置卡面<select id="card-preset">' + options([['', '选择背景与排版'], ...d.presets.map(p => [p.id, p.title])], '') + '</select></label><label>背景图片<input id="card-background" type="file" accept="image/png,image/jpeg,image/webp"></label><p class="hint">选图后在本地居中裁切，保存或真实预览时才上传；上传的背景可通过链接访问</p>' +
            '<div class="actions">' + ui.btn(failedFonts.size ? '重新加载字体' : '准备字体', 'card-fonts') + '</div>' +
            '<p id="card-font-status" class="muted">字体：' + (state.fonts.regular && state.fonts.bold ? '已准备' : '尚未完整准备') + '</p></div>' +
            '<div class="card-control-group"><h3>渲染区域</h3><label>当前区域<select id="card-region">' + options(c.regions.map((item, index) => [item.id, (index + 1) + ' · ' + (item.text === undefined ? d.fields.find(f => f.key === item.field)?.label || item.field : '自定义内容')]), regionId) + '</select></label>' +
            '<div class="actions"><button id="card-add-region" data-action="card-add">添加区域</button>' + (r ? ui.btn('删除区域', 'card-delete') : '') + '</div>' +
            (r ? '<label>显示内容<select id="card-field">' + options([['', '自定义文字与变量'], ...d.fields.map(f => [f.key, f.label])], r.text === undefined ? r.field : '') + '</select></label>' + (r.text !== undefined ? '<label>区域内容<textarea id="card-text" rows="3" maxlength="1000">' + esc(r.text) + '</textarea></label><p class="hint">文字与 Emoji 可直接输入，变量使用下面的原始写法</p>' : '') + '<div class="card-numbers">' +
                field('x', '左边距', r.x, 'number', 'min="0" max="539"') + field('y', '上边距', r.y, 'number', 'min="0" max="' + (d.height - 1) + '"') +
                field('width', '宽度', r.width, 'number', 'min="12" max="540"') + field('height', '高度', r.height, 'number', 'min="12" max="' + d.height + '"') +
                field('size', '字号', r.size, 'number', 'min="12" max="72"') + field('lineHeight', '行距', r.lineHeight, 'number', 'min="12" max="100"') + '</div>' +
                '<div class="card-numbers"><label>字重<select id="card-weight">' + options([['400', '常规'], ['700', '粗体']], r.weight) + '</select></label><label>对齐<select id="card-align">' + options([['left', '左对齐'], ['center', '居中'], ['right', '右对齐']], r.align) + '</select></label>' + field('color', '颜色', r.color, 'color') + '</div>' : '<p class="muted">添加区域后选择要显示的内容</p>') + '</div>' +
            '<div class="actions">' + ui.btn('保存卡面', 'card-save', '', 'primary') + ui.btn('撤销修改', 'card-cancel') + ui.btn('真实预览', 'card-real') + '</div>' +
            '<p class="hint">关闭自定义时按业务使用内置卡面，模块的图片开关仍需开启<br>真实预览调用 Images，先检查本地排版再生成</p><details><summary>当前位置可用变量</summary>' + d.fields.map(f => '<div><code>{{' + esc(f.key) + '}}</code> · ' + esc(f.label) + '</div>').join('') + '</details>' +
            (r && r.text === undefined ? '<details><summary>本地样例文字</summary><label>当前区域样例<textarea id="card-sample" rows="3">' + esc(values()[r.field] || '') + '</textarea></label><p class="hint">仅用于预览，不修改实际业务文案</p></details>' : '') +
            '</div><div class="card-preview-column"><h3>本地预览</h3><label>本地样例<select id="card-scenario">' + options(d.samples.map(s => [s.id, s.title]), sampleIds[selected] || d.samples[0].id) + '</select></label><div id="card-stage" class="card-stage" style="aspect-ratio:540/' + d.height + '"><canvas aria-label="卡面本地预览" role="img" id="card-canvas" width="540" height="' + d.height + '"></canvas><div id="card-regions"></div></div>' +
            '<p id="card-overflow" role="status" class="error"></p><p id="card-local-status" class="hint"></p>' +
            (realURL ? '<h3>真实预览' + (realStale ? ' · 修改后需重新生成' : '') + '</h3><img class="card-real-image" alt="Images 真实预览" src="' + esc(realURL) + '">' : '') + '</div></div></section>';
    }

    function changed(enable = true) {
        if (enable) { design().enabled = true; }

        app.dirty = true;
        realStale = !!realURL;
        app.updateDirty();
    }

    ${cardResources}${cardCanvas}
    function input(el) {
        if (!state) { return; }

        if (el.id === 'card-sample') {
            samples[selected] = { ...values(), [region().field]: el.value };
            realStale = !!realURL;
            void paint();

            return;
        }

        if (el.id === 'card-text') {
            region().text = el.value;
            changed();
            void paint();

            return;
        }

        const r = region(), key = el.id.replace('card-', '');

        if (r && ['x', 'y', 'width', 'height', 'size', 'lineHeight', 'color'].includes(key)) {
            r[key] = key === 'color' ? el.value : Number(el.value);
            normalize(r);
            changed();
            boxes();
            void paint();
        }
    }

    function change(el) {
        if (!state) { return; }

        if (el.id === 'card-kind') {
            selected = el.value;
            regionId = design().regions[0]?.id || '';
            revokePreview();
            app.render();
        }
        else if (el.id === 'card-region') {
            regionId = el.value;
            app.render();
        }
        else if (el.id === 'card-enabled') {
            design().enabled = el.checked;
            changed(false);
        }
        else if (el.id === 'card-preset' && el.value) {
            clearPending(selected);
            draft[selected] = structuredClone(definition().presets.find(p => p.id === el.value).design);
            regionId = design().regions[0]?.id || '';
            changed();
            app.render();
        }
        else if (el.id === 'card-scenario') {
            sampleIds[selected] = el.value;
            delete samples[selected];
            realStale = !!realURL;
            app.render();
        }
        else if (el.id === 'card-background') { void app.run(() => localBackground(el.files[0])); }
        else if (el.id === 'card-field') {
            const r = region();
            r.field = el.value;

            if (el.value) { delete r.text; } else { r.text = ''; }

            changed();
            app.render();
        }
        else if (['card-weight', 'card-align'].includes(el.id)) {
            region()[el.id.slice(5)] = el.id === 'card-weight' ? Number(el.value) : el.value;
            changed();
            app.render();
        }
        else { syncNumbers(); }
    }

    function checkDraft(d, preview = false) {
        const c = draft[d.id];

        if (!preview && !c.enabled && (!c.background || !c.regions.length)) { return; }

        if (!c.background || !c.regions.length) { throw Error('请选择背景并添加区域'); }

        for (const r of c.regions) {
            try { validateRegionContent(r, d.fields); } catch (error) {
                if (d.id === selected && r.id === regionId && r.text !== undefined) {
                    ui.fieldError('card-text', error.message);
                    app.focus('card-text');
                    error.fieldHandled = true;
                }

                throw error;
            }

            if (r.x < 0 || r.y < 0 || r.width < 12 || r.height < r.size || r.x + r.width > d.width || r.y + r.height > d.height) { throw Error('区域超出卡面边界'); }
        }

        if (d.id === selected && layoutCard(c, values(), cardWidths, inlineCommandTools.expand).overflow.length) { throw Error('文字超出区域，请先调整本地排版'); }
    }

    async function action(a) {
        if (a === 'card-retry') {
            failure = '';
            await load();
        }

        if (!state) { return; }

        if (a === 'card-add') {
            if (design().regions.length >= 24) { throw Error('最多设置 24 个区域'); }

            const r = { id: crypto.randomUUID(), field: '', text: '✨ {{' + definition().fields[0].key + '}}', x: 30, y: 30, width: 480, height: 60, size: 28, weight: 400, color: '#233447', align: 'left', lineHeight: 36 };
            design().regions.push(r);
            regionId = r.id;
            changed();
            app.render();
            app.focus('card-text');
        } else if (a === 'card-delete') {
            const index = design().regions.findIndex(r => r.id === regionId);
            design().regions = design().regions.filter(r => r.id !== regionId);
            regionId = design().regions[Math.min(index, design().regions.length - 1)]?.id || '';
            changed();
            app.render();
            app.focus(region() ? region().text !== undefined ? 'card-text' : 'card-field' : 'card-add-region');
        }
        else if (a === 'card-cancel') {
            if (app.dirty && !await app.confirmAction('撤销当前所有卡面修改？')) { return; }

            for (const id of pending.keys()) { clearPending(id); }

            draft = structuredClone(state.module.config.cardDesigns.config);
            app.dirty = false;
            regionId = design().regions[0]?.id || '';
            revokePreview();
            app.render();
        }
        else if (a === 'card-fonts') {
            failedFonts.clear();

            for (const weight of [400, 700]) {
                const key = weight === 400 ? 'regular' : 'bold';

                if (!state.fonts[key]) {
                    await request('font', { weight });
                    state.fonts[key] = true;
                }
            }

            app.render();
            app.status('字体已存入 R2');
        } else if (a === 'card-save') {
            if (!synchronized) { throw Error('配置状态未确认，请刷新配置后继续'); }

            for (const d of state.definitions) { checkDraft(d); }

            if (!pending.size && JSON.stringify(draft) === JSON.stringify(state.module.config.cardDesigns.config)) {
                app.dirty = false;
                app.status('卡面未变化');
                app.render();

                return;
            }

            if (new TextEncoder().encode(JSON.stringify(draft)).length > 38000) { throw Error("卡面配置过大，请精简区域文案"); }

            if (state.definitions.some(d => draft[d.id].enabled && draft[d.id].regions.some(r => !state.fonts[r.weight === 400 ? "regular" : "bold"]))) { throw Error("请先准备字体"); }

            for (const id of [...pending.keys()]) { await uploadPending(id); }

            try {
                const result = await (await request('save', { revision: state.module.config.cardDesigns.revision, config: draft })).json();
                app.checkedState(result.module);
                state = { ...state, ...result };
                draft = structuredClone(result.module.config.cardDesigns.config);
                app.dirty = false;
                applyModule(result.module);
                loadedRevision = result.module.revision;

                app.render();
                app.status('卡面已保存');
            } catch (error) {
                if (error.kind !== 'validation') {
                    synchronized = false;
                    error.message += '，当前草稿仍保留，请刷新配置后继续';
                }

                throw error;
            }
        } else if (a === 'card-real') {
            checkDraft(definition(), true);

            if (design().regions.some(r => !state.fonts[r.weight === 400 ? 'regular' : 'bold'])) { throw Error('请先准备字体'); }

            await uploadPending(selected);
            const response = await request('preview', { id: selected, design: design(), values: values() });
            const blob = await response.blob();
            revokePreview();
            realURL = URL.createObjectURL(blob);
            app.render();
            app.status('真实预览已生成');
        }
    }

    function reset(invalidate = true) {
        for (const id of pending.keys()) { clearPending(id); }

        generation++;
        loading = false;

        if (invalidate) {
            state = null;
            failedFonts.clear();
        }

        draft = state ? structuredClone(state.module.config.cardDesigns.config) : null;
        regionId = draft?.[selected]?.regions[0]?.id || '';
        failure = '';
        imageToken++;
        background = null;
        backgroundAsset = '';
        backgroundPending = null;
        revokePreview();
    }

    return {
        loaded: () => !!state, isLoading: () => loading, loadAction: () => state ? 'reload' : 'card-retry',
        render, refresh, action, input, change, reset, load: () => {
            reset();

            return load();
        }, isDirty: () => Boolean(state && (pending.size || JSON.stringify(draft) !== JSON.stringify(state.module.config.cardDesigns.config))), transientInputs: ['card-kind', 'card-region', 'card-sample', 'card-background', 'card-scenario']
    };
}
`;
