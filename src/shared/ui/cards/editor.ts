import { createTextLayout, layoutCard, emojiURL } from "../../cards/layout.js";
import { validateRegionContent } from "../../cards/validation.js";
import metrics from "../../cards/metrics.json";
import { fontAsset } from "../../cards/types.js";
export const cardEditor = `const cardWidths = ${JSON.stringify(metrics)};\nconst validateRegionContent = ${validateRegionContent.toString()};\nconst createTextLayout = ${createTextLayout.toString()};
const layoutCard = ${layoutCard.toString()};\nconst cardEmojiURL = ${emojiURL.toString()};\nconst cardFontNames = ${JSON.stringify({ 400: fontAsset(400), 700: fontAsset(700) })};\n` + String.raw`
function createCardEditor(app, ui) {
    let state = null, draft = null, selected = '', regionId = '', loading = false, failure = '', generation = 0, loadedRevision;
    let realURL = '', realStale = false, background = null, backgroundAsset = '', backgroundPending = null, imageToken = 0, synchronized = true;
    const sprites = new Map(), fontLoads = new Map(), fonts = new Set(), samples = {}, sampleIds = {}, pending = new Map();
    const assetURL = asset => state.assets[asset]?.url || new URL('../cards/assets/' + asset, location.href).href;
    const definition = () => state.definitions.find(item => item.id === selected);
    const design = () => draft[selected];
    const region = () => design().regions.find(item => item.id === regionId);
    const values = () => ({ ...Object.fromEntries(definition().fields.map(field => [field.key, field.sample])), ...(definition().samples.find(s => s.id === sampleIds[selected]) || definition().samples[0]).values, ...samples[selected] });
    const esc = ui.esc;
    async function request(action, data, raw = false) {
        const response = await app.resource('/api/cards/' + app.id + '/' + action, data === undefined ? {} : { method: 'POST', headers: { 'content-type': raw ? 'image/png' : 'application/json' }, body: raw ? data : JSON.stringify(data) });
        if (!response.ok) { const error = await response.json(); throw Object.assign(Error(error.error || '请求失败'), { kind: error.kind }); }
        return response;
    }
    function applyModule(module) {
        const config = { ...module.config };
        // Revision zero is an unsaved default draft, not module configuration.
        if (config.cardDesigns.revision === 0) { delete config.cardDesigns; }

        app.state = { ...app.state, ...module, config };
        app.config = structuredClone(config);
        app.synchronized = true;
    }
    async function load() {
        if (loading || state) { return; }

        loading = true;
        const current = generation;

        try {
            const result = await (await request('state')).json();
            if (current !== generation) { return; }

            applyModule(result.module);
            state = result; loadedRevision = result.module.revision; draft = structuredClone(result.module.config.cardDesigns.config); selected ||= result.definitions[0].id;
            regionId = draft[selected].regions[0]?.id || ''; failure = ''; synchronized = true;
        } catch (error) { if (current === generation) { failure = error.message; } }
        finally { if (current === generation) { loading = false; if (ui.$('card-editor')) { app.render(); } } }
    }
    function options(items, value) { return items.map(([id, label]) => '<option value="' + esc(id) + '"' + (id === String(value) ? ' selected' : '') + '>' + esc(label) + '</option>').join(''); }
    function field(key, label, value, type = 'number', extra = '') { return '<label>' + label + '<input id="card-' + key + '" type="' + type + '" value="' + esc(value) + '" ' + extra + '></label>'; }
    function render() {
        if (!state) { return '<section id="card-editor"><p role="status">' + esc(failure || '正在加载卡面…') + '</p>' + (failure ? ui.btn('重试', 'card-retry') : '') + '</section>'; }
        const d = definition(), c = design(), r = region();
        return '<section id="card-editor"><div class="card-toolbar"><label>编辑卡面<select id="card-kind">' + options(state.definitions.map(item => [item.id, item.title]), selected) + '</select></label>' +
            '<label class="card-toggle"><input id="card-enabled" type="checkbox"' + (c.enabled ? ' checked' : '') + '>使用自定义卡面</label></div>' +
            '<p class="muted">' + d.width + ' × ' + d.height + ' · 在图片上拖出区域，拖动区域移动，拖动右下角缩放</p>' +
            '<div class="card-editor-grid"><div class="card-editor-controls"><div class="card-control-group"><h3>背景与字体</h3>' +
            '<label>内置卡面<select id="card-preset">' + options([['','选择背景与排版'],...d.presets.map(p => [p.id,p.title])],'') + '</select></label><label>背景图片<input id="card-background" type="file" accept="image/png,image/jpeg,image/webp"></label><p class="hint">选图后在本地居中裁切，保存或真实预览时才上传；上传的背景可通过链接访问</p>' +
            '<div class="actions">' + ui.btn('准备字体', 'card-fonts') + '</div>' +
            '<p id="card-font-status" class="muted">字体：' + (state.fonts.regular && state.fonts.bold ? '已准备' : '尚未完整准备') + '</p></div>' +
            '<div class="card-control-group"><h3>渲染区域</h3><label>当前区域<select id="card-region">' + options(c.regions.map((item, index) => [item.id, (index + 1) + ' · ' + (item.text === undefined ? d.fields.find(f => f.key === item.field)?.label || item.field : '自定义内容')]), regionId) + '</select></label>' +
            '<div class="actions">' + ui.btn('添加区域', 'card-add') + (r ? ui.btn('删除区域', 'card-delete') : '') + '</div>' +
            (r ? '<label>显示内容<select id="card-field">' + options([['','自定义文字与变量'],...d.fields.map(f => [f.key, f.label])], r.text === undefined ? r.field : '') + '</select></label>' + (r.text !== undefined ? '<label>区域内容<textarea id="card-text" rows="3" maxlength="1000">' + esc(r.text) + '</textarea></label><p class="hint">文字与 Emoji 可直接输入，变量使用下面的原始写法</p>' : '') + '<div class="card-numbers">' +
            field('x', '左边距', r.x, 'number', 'min="0" max="539"') + field('y', '上边距', r.y, 'number', 'min="0" max="' + (d.height - 1) + '"') +
            field('width', '宽度', r.width, 'number', 'min="12" max="540"') + field('height', '高度', r.height, 'number', 'min="12" max="' + d.height + '"') +
            field('size', '字号', r.size, 'number', 'min="12" max="72"') + field('lineHeight', '行距', r.lineHeight, 'number', 'min="12" max="100"') + '</div>' +
            '<div class="card-numbers"><label>字重<select id="card-weight">' + options([['400','常规'],['700','粗体']], r.weight) + '</select></label><label>对齐<select id="card-align">' + options([['left','左对齐'],['center','居中'],['right','右对齐']], r.align) + '</select></label>' + field('color', '颜色', r.color, 'color') + '</div>' : '<p class="muted">添加区域后选择要显示的内容</p>') + '</div>' +
            '<div class="actions">' + ui.btn('保存卡面', 'card-save', '', 'primary') + ui.btn('撤销修改', 'card-cancel') + ui.btn('真实预览', 'card-real') + '</div>' +
            '<p class="hint">关闭自定义时按业务使用内置卡面，模块的图片开关仍需开启<br>真实预览调用 Images，先检查本地排版再生成</p><details><summary>当前位置可用变量</summary>' + d.fields.map(f => '<div><code>{{' + esc(f.key) + '}}</code> · ' + esc(f.label) + '</div>').join('') + '</details>' +
            (r && r.text === undefined ? '<details><summary>本地样例文字</summary><label>当前区域样例<textarea id="card-sample" rows="3">' + esc(values()[r.field] || '') + '</textarea></label><p class="hint">仅用于预览，不修改实际业务文案</p></details>' : '') +
            '</div><div class="card-preview-column"><h3>本地预览</h3><label>本地样例<select id="card-scenario">' + options(d.samples.map(s => [s.id,s.title]), sampleIds[selected] || d.samples[0].id) + '</select></label><div id="card-stage" class="card-stage" style="aspect-ratio:540/' + d.height + '"><canvas aria-label="卡面本地预览" role="img" id="card-canvas" width="540" height="' + d.height + '"></canvas><div id="card-regions"></div></div>' +
            '<p id="card-overflow" role="status" class="error"></p><p id="card-local-status" class="hint"></p>' +
            (realURL ? '<h3>真实预览' + (realStale ? ' · 修改后需重新生成' : '') + '</h3><img class="card-real-image" alt="Images 真实预览" src="' + esc(realURL) + '">' : '') + '</div></div></section>';
    }
    function changed(enable = true) { if (enable) { design().enabled = true; } app.dirty = true; realStale = !!realURL; ui.$('dirty').hidden = false; }
    function normalize(r) {
        r.size = Math.max(12, Math.min(72, Math.round(r.size) || 12));
        r.lineHeight = Math.max(r.size, Math.min(100, Math.round(r.lineHeight) || r.size));
        r.width = Math.max(12, Math.min(540, Math.round(r.width) || 12));
        r.height = Math.max(r.size, Math.min(definition().height, Math.round(r.height) || r.size));
        r.x = Math.max(0, Math.min(540 - r.width, Math.round(r.x) || 0));
        r.y = Math.max(0, Math.min(definition().height - r.height, Math.round(r.y) || 0));
    }
    function syncNumbers() { const r = region(); if (!r) { return; } for (const key of ['x','y','width','height','size','lineHeight']) { const el = ui.$('card-' + key); if (el) { el.value = r[key]; } } }
    function boxes() {
        const node = ui.$('card-regions');
        if (!node) { return; }
        node.innerHTML = design().regions.map((r,index) => '<div class="card-region-box' + (r.id === regionId ? ' selected' : '') + '" data-region="' + r.id + '" tabindex="0" role="button" aria-label="区域 ' + (index + 1) + '，方向键移动" style="left:' + r.x / 540 * 100 + '%;top:' + r.y / definition().height * 100 + '%;width:' + r.width / 540 * 100 + '%;height:' + r.height / definition().height * 100 + '%"><span>' + (index + 1) + '</span><i data-resize="true"></i></div>').join('');
    }
    async function image(url) { const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url; await img.decode(); return img; }
    async function paint() {
        const canvas = ui.$('card-canvas');
        if (!canvas || !state) { return; }
        const ctx = canvas.getContext('2d'), token = ++imageToken;
        try {
            const asset = design().background;
            if (asset !== backgroundAsset) { backgroundAsset = asset; backgroundPending = asset ? image(pending.get(selected)?.url || assetURL(asset)) : Promise.resolve(null); }
            background = backgroundPending ? await backgroundPending : null;
            if (token !== imageToken || !canvas.isConnected) { return; }
            ctx.clearRect(0,0,canvas.width,canvas.height);
            if (background) { ctx.drawImage(background,0,0,canvas.width,canvas.height); } else { ctx.fillStyle = '#f5f7f5'; ctx.fillRect(0,0,canvas.width,canvas.height); }
            for (const r of design().regions) { validateRegionContent(r, definition().fields); }
            const result = layoutCard(design(), values(), cardWidths, inlineCommandTools.expand);
            const weights = new Set(result.layers.filter(layer => layer.text).map(layer => layer.weight));
            loadFonts(weights);
            ui.$('card-overflow').textContent = result.overflow.length ? '文字超出区域：' + result.overflow.map(id => design().regions.findIndex(r => r.id === id) + 1).join('、') : '';
            for (const layer of result.layers) {
                if (layer.emoji) {
                    if (!sprites.has(layer.emoji)) { sprites.set(layer.emoji, image(cardEmojiURL(layer.emoji))); }
                    const img = await sprites.get(layer.emoji);
                    if (token !== imageToken || !canvas.isConnected) { return; }
                    ctx.drawImage(img,layer.left,layer.top,layer.size,layer.size);
                } else {
                    ctx.font = layer.size + 'px "DailyCard' + layer.weight + '", sans-serif'; ctx.fillStyle = layer.color;
                    ctx.textBaseline = 'alphabetic';
                    const box = ctx.measureText(layer.text);
                    ctx.fillText(layer.text, layer.left + box.actualBoundingBoxLeft, layer.top + box.actualBoundingBoxAscent);
                }
            }
            ui.$('card-local-status').textContent = [...weights].every(weight => fonts.has(weight)) ? '使用 R2 字体，正式效果以真实预览为准' : '当前为系统字体预览，准备字体后可使用统一字体';
        } catch (error) { if (token === imageToken && ui.$('card-local-status')) { ui.$('card-local-status').textContent = '预览失败：' + error.message; } }
    }
    function loadFonts(weights) {
        for (const weight of weights) {
            if (fonts.has(weight) || fontLoads.has(weight) || !state?.fonts[weight === 400 ? 'regular' : 'bold']) { continue; }
            const current = generation, font = new FontFace('DailyCard' + weight, 'url("' + assetURL(cardFontNames[weight]) + '")');
            fontLoads.set(weight, font.load().then(() => {
                document.fonts.add(font); fonts.add(weight);
                if (current === generation) { void paint(); }
            }).catch(() => app.status('字体加载失败，可重新打开卡面页重试', true)).finally(() => fontLoads.delete(weight)));
        }
    }
    function refresh() {
        if (state && loadedRevision !== app.state.revision) { reset(); app.render(); return; }

        if (!state) { if (!failure) { void load(); } return; }

        boxes(); void paint();
        const stage = ui.$('card-stage');
        let drag = null;
        const point = event => { const rect = stage.getBoundingClientRect(); return { x: (event.clientX - rect.left) / rect.width * 540, y: (event.clientY - rect.top) / rect.height * definition().height }; };
        stage.onpointerdown = event => {
            if (document.body.classList.contains('busy') || event.button !== 0) { return; }
            const box = event.target.closest('[data-region]'), p = point(event);
            if (box) {
                regionId = box.dataset.region;
                drag = { start: p, original: { ...region() }, mode: event.target.dataset.resize ? 'resize' : 'move' };
            } else {
                if (design().regions.length >= 24) { app.status('最多设置 24 个区域', true); return; }
                const r = { id: crypto.randomUUID(), field: '', text: '✨ {{' + definition().fields[0].key + '}}', x: Math.round(p.x), y: Math.round(p.y), width: 100, height: 36, size: 24, weight: 400, color: '#233447', align: 'left', lineHeight: 30 };
                normalize(r); design().regions.push(r); regionId = r.id; drag = { start: p, original: { ...r }, mode: 'new' }; changed();
            }
            stage.setPointerCapture(event.pointerId); event.preventDefault(); boxes();
        };
        stage.onpointermove = event => {
            if (!drag || document.body.classList.contains('busy')) { return; }
            const p = point(event), r = region(), dx = Math.round(p.x - drag.start.x), dy = Math.round(p.y - drag.start.y);
            if (drag.mode === 'move') { r.x = drag.original.x + dx; r.y = drag.original.y + dy; }
            else if (drag.mode === 'resize') { r.width = Math.min(540 - r.x, drag.original.width + dx); r.height = Math.min(definition().height - r.y, drag.original.height + dy); }
            else { r.x = Math.min(drag.start.x,p.x); r.y = Math.min(drag.start.y,p.y); r.width = Math.abs(dx); r.height = Math.abs(dy); }
            normalize(r); changed(); boxes(); syncNumbers(); void paint();
        };
        stage.onpointerup = stage.onpointercancel = () => { if (drag) { drag = null; app.render(); } };
        stage.onkeydown = event => {
            const box = event.target.closest('[data-region]');
            if (document.body.classList.contains('busy') || !box || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) { return; }
            event.preventDefault(); const selectionChanged = regionId !== box.dataset.region; regionId = box.dataset.region; const r = region(), step = event.shiftKey ? 10 : 1;
            r.x += event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
            r.y += event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
            normalize(r); changed(); if (selectionChanged) { app.render(); } else { boxes(); syncNumbers(); void paint(); } ui.$('card-regions').querySelector('[data-region="' + regionId + '"]')?.focus({preventScroll:true});
        };
    }
    function input(el) {
        if (!state) { return; }
        if (el.id === 'card-sample') { samples[selected] = { ...values(), [region().field]: el.value }; realStale = !!realURL; void paint(); return; }
        if (el.id === 'card-text') { region().text = el.value; changed(); void paint(); return; }
        const r = region(), key = el.id.replace('card-','');
        if (r && ['x','y','width','height','size','lineHeight','color'].includes(key)) { r[key] = key === 'color' ? el.value : Number(el.value); normalize(r); changed(); boxes(); void paint(); }
    }
    function change(el) {
        if (!state) { return; }
        if (el.id === 'card-kind') { selected = el.value; regionId = design().regions[0]?.id || ''; revokePreview(); app.render(); }
        else if (el.id === 'card-region') { regionId = el.value; app.render(); }
        else if (el.id === 'card-enabled') { design().enabled = el.checked; changed(false); }
        else if (el.id === 'card-preset' && el.value) { clearPending(selected); draft[selected] = structuredClone(definition().presets.find(p => p.id === el.value).design); regionId = design().regions[0]?.id || ''; changed(); app.render(); }
        else if (el.id === 'card-scenario') { sampleIds[selected] = el.value; delete samples[selected]; realStale = !!realURL; app.render(); }
        else if (el.id === 'card-background') { void app.run(() => localBackground(el.files[0])); }
        else if (el.id === 'card-field') { const r = region(); r.field = el.value; if (el.value) { delete r.text; } else { r.text = ''; } changed(); app.render(); }
        else if (['card-weight','card-align'].includes(el.id)) { region()[el.id.slice(5)] = el.id === 'card-weight' ? Number(el.value) : el.value; changed(); app.render(); }
        else { syncNumbers(); }
    }
    function checkDraft(d, preview = false) {
        const c = draft[d.id];
        if (!preview && !c.enabled && (!c.background || !c.regions.length)) { return; }
        if (!c.background || !c.regions.length) { throw Error('请选择背景并添加区域'); }
        for (const r of c.regions) {
            validateRegionContent(r, d.fields);
            if (r.x < 0 || r.y < 0 || r.width < 12 || r.height < r.size || r.x + r.width > d.width || r.y + r.height > d.height) { throw Error('区域超出卡面边界'); }
        }
        if (d.id === selected && layoutCard(c, values(), cardWidths, inlineCommandTools.expand).overflow.length) { throw Error('文字超出区域，请先调整本地排版'); }
    }
    function clearPending(id) { const entry = pending.get(id); if (entry) { URL.revokeObjectURL(entry.url); pending.delete(id); } }
    async function localBackground(file) {
        if (!file) { return; }
        if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 10_000_000) { throw Error('请选择 10 MB 以内的 PNG、JPEG 或 WebP'); }
        const id = selected, d = definition(), current = generation;
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas'); canvas.width = 540; canvas.height = d.height;
        const scale = Math.max(540 / bitmap.width, canvas.height / bitmap.height);
        canvas.getContext('2d').drawImage(bitmap,(540-bitmap.width*scale)/2,(canvas.height-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale); bitmap.close();
        const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png'));
        if (current !== generation) { return; }
        if (!blob || blob.size > 2_000_000) { throw Error('处理后的背景超过 2 MB，请换一张图片'); }
        clearPending(id); pending.set(id, {blob,url:URL.createObjectURL(blob)}); draft[id].background = 'local:' + crypto.randomUUID(); draft[id].enabled = true;
        changed(false); backgroundAsset = ''; app.render(); app.status('图片仅在本地，保存或真实预览时上传');
    }
    async function uploadPending(id) {
        const entry = pending.get(id);
        if (!entry) { return; }
        const result = await (await request('background?card=' + id,entry.blob,true)).json();
        draft[id].background = result.asset; clearPending(id); backgroundAsset = '';
    }
    function revokePreview() { if (realURL) { URL.revokeObjectURL(realURL); realURL = ''; } realStale = false; }
    async function action(a) {
        if (a === 'card-retry') { failure = ''; await load(); }
        if (!state) { return; }
        if (a === 'card-add') {
            if (design().regions.length >= 24) { throw Error('最多设置 24 个区域'); }
            const r = { id: crypto.randomUUID(), field: '', text: '✨ {{' + definition().fields[0].key + '}}', x: 30, y: 30, width: 480, height: 60, size: 28, weight: 400, color: '#233447', align: 'left', lineHeight: 36 };
            design().regions.push(r); regionId = r.id; changed(); app.render();
        } else if (a === 'card-delete') { design().regions = design().regions.filter(r => r.id !== regionId); regionId = design().regions[0]?.id || ''; changed(); app.render(); }
        else if (a === 'card-cancel') { if (app.dirty && !await app.confirmAction('撤销当前所有卡面修改？')) { return; } for (const id of pending.keys()) { clearPending(id); } draft = structuredClone(state.module.config.cardDesigns.config); app.dirty = false; regionId = design().regions[0]?.id || ''; revokePreview(); app.render(); }
        else if (a === 'card-fonts') {
            for (const weight of [400,700]) { const key = weight === 400 ? 'regular' : 'bold'; if (!state.fonts[key]) { await request('font',{weight}); state.fonts[key] = true; } }
            app.render(); app.status('字体已存入 R2');
        } else if (a === 'card-save') {
            if (!synchronized) { throw Error('配置状态未确认，请刷新配置后继续'); }
            for (const d of state.definitions) { checkDraft(d); }
            if (!pending.size && JSON.stringify(draft) === JSON.stringify(state.module.config.cardDesigns.config)) { app.dirty = false; app.status('卡面未变化'); app.render(); return; }
            if (new TextEncoder().encode(JSON.stringify(draft)).length > 38000) { throw Error("卡面配置过大，请精简区域文案"); }
            if (state.definitions.some(d => draft[d.id].enabled && draft[d.id].regions.some(r => !state.fonts[r.weight === 400 ? "regular" : "bold"]))) { throw Error("请先准备字体"); }
            for (const id of [...pending.keys()]) { await uploadPending(id); }
            try {
                const result = await (await request('save',{revision:state.module.config.cardDesigns.revision,config:draft})).json();
                state = { ...state, ...result }; draft = structuredClone(result.module.config.cardDesigns.config); app.dirty = false;
                applyModule(result.module);
                loadedRevision = result.module.revision;

                app.render(); app.status('卡面已保存');
            } catch(error) { if(error.kind !== 'validation') { synchronized = false; error.message += '，当前草稿仍保留，请刷新配置后继续'; } throw error; }
        } else if (a === 'card-real') {
            checkDraft(definition(), true);
            if (design().regions.some(r => !state.fonts[r.weight === 400 ? 'regular' : 'bold'])) { throw Error('请先准备字体'); }
            await uploadPending(selected);
            const response = await request('preview',{id:selected,design:design(),values:values()});
            const blob = await response.blob(); revokePreview(); realURL = URL.createObjectURL(blob); app.render(); app.status('真实预览已生成');
        }
    }
    function reset(invalidate = true) {
        for (const id of pending.keys()) { clearPending(id); }

        generation++; loading = false;

        if (invalidate) { state = null; }

        draft = state ? structuredClone(state.module.config.cardDesigns.config) : null;
        regionId = draft?.[selected]?.regions[0]?.id || ''; failure = ''; imageToken++;
        background = null; backgroundAsset = ''; backgroundPending = null; revokePreview();
    }
    return { render,refresh,action,input,change,reset,transientInputs:['card-kind','card-region','card-sample','card-background','card-scenario'] };
}
`;
