export const cardCanvas = String.raw`
function normalize(r) {
    r.size = Math.max(12, Math.min(72, Math.round(r.size) || 12));
    r.lineHeight = Math.max(r.size, Math.min(100, Math.round(r.lineHeight) || r.size));
    r.width = Math.max(12, Math.min(540, Math.round(r.width) || 12));
    r.height = Math.max(r.size, Math.min(definition().height, Math.round(r.height) || r.size));
    r.x = Math.max(0, Math.min(540 - r.width, Math.round(r.x) || 0));
    r.y = Math.max(0, Math.min(definition().height - r.height, Math.round(r.y) || 0));
}

function syncNumbers() {
    const r = region();

    if (!r) { return; }

    for (const key of ['x', 'y', 'width', 'height', 'size', 'lineHeight']) {
        const el = ui.$('card-' + key);

        if (el) { el.value = r[key]; }
    }
}

function boxes() {
    const node = ui.$('card-regions');

    if (!node) { return; }

    node.innerHTML = design().regions.map((r, index) => '<div class="card-region-box' + (r.id === regionId ? ' selected' : '') + '" data-region="' + r.id + '" tabindex="0" role="button" aria-label="区域 ' + (index + 1) + '，方向键移动" style="left:' + r.x / 540 * 100 + '%;top:' + r.y / definition().height * 100 + '%;width:' + r.width / 540 * 100 + '%;height:' + r.height / definition().height * 100 + '%"><span>' + (index + 1) + '</span><i data-resize="true"></i></div>').join('');
}

async function paint() {
    const canvas = ui.$('card-canvas');

    if (!canvas || !state) { return; }

    const ctx = canvas.getContext('2d'), token = ++imageToken;

    try {
        const asset = design().background;

        if (asset !== backgroundAsset) {
            backgroundAsset = asset;
            backgroundPending = asset ? image(pending.get(selected)?.url || assetURL(asset)) : Promise.resolve(null);
        }

        background = backgroundPending ? await backgroundPending : null;

        if (token !== imageToken || !canvas.isConnected) { return; }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (background) { ctx.drawImage(background, 0, 0, canvas.width, canvas.height); } else {
            ctx.fillStyle = '#f5f7f5';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

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

                ctx.drawImage(img, layer.left, layer.top, layer.size, layer.size);
            } else {
                ctx.font = layer.size + 'px "DailyCard' + layer.weight + '", sans-serif';
                ctx.fillStyle = layer.color;
                ctx.textBaseline = 'alphabetic';
                const box = ctx.measureText(layer.text);
                ctx.fillText(layer.text, layer.left + box.actualBoundingBoxLeft, layer.top + box.actualBoundingBoxAscent);
            }
        }

        ui.$('card-local-status').textContent = [...weights].every(weight => fonts.has(weight)) ? '使用 R2 字体，正式效果以真实预览为准' : '当前为系统字体预览，准备字体后可使用统一字体';
    } catch (error) { if (token === imageToken && ui.$('card-local-status')) { ui.$('card-local-status').textContent = '预览失败：' + error.message; } }
}

function refresh() {
    if (state && loadedRevision !== app.state.revision) {
        reset();
        app.render();

        return;
    }

    if (!state) {
        return;
    }

    boxes();
    void paint();
    const stage = ui.$('card-stage');
    let drag = null;
    const point = event => {
        const rect = stage.getBoundingClientRect();

        return { x: (event.clientX - rect.left) / rect.width * 540, y: (event.clientY - rect.top) / rect.height * definition().height };
    };
    stage.onpointerdown = event => {
        if (document.body.classList.contains('busy') || event.button !== 0) { return; }

        const box = event.target.closest('[data-region]'), p = point(event);

        if (box) {
            regionId = box.dataset.region;
            drag = { start: p, original: { ...region() }, mode: event.target.dataset.resize ? 'resize' : 'move' };
        } else {
            if (design().regions.length >= 24) {
                app.status('最多设置 24 个区域', true);

                return;
            }

            const r = { id: crypto.randomUUID(), field: '', text: '✨ {{' + definition().fields[0].key + '}}', x: Math.round(p.x), y: Math.round(p.y), width: 100, height: 36, size: 24, weight: 400, color: '#233447', align: 'left', lineHeight: 30 };
            normalize(r);
            design().regions.push(r);
            regionId = r.id;
            drag = { start: p, original: { ...r }, mode: 'new' };
            changed();
        }

        stage.setPointerCapture(event.pointerId);
        event.preventDefault();
        boxes();
    };
    stage.onpointermove = event => {
        if (!drag || document.body.classList.contains('busy')) { return; }

        const p = point(event), r = region(), dx = Math.round(p.x - drag.start.x), dy = Math.round(p.y - drag.start.y);

        if (drag.mode === 'move') {
            r.x = drag.original.x + dx;
            r.y = drag.original.y + dy;
        }
        else if (drag.mode === 'resize') {
            r.width = Math.min(540 - r.x, drag.original.width + dx);
            r.height = Math.min(definition().height - r.y, drag.original.height + dy);
        }
        else {
            r.x = Math.min(drag.start.x, p.x);
            r.y = Math.min(drag.start.y, p.y);
            r.width = Math.abs(dx);
            r.height = Math.abs(dy);
        }

        normalize(r);
        changed();
        boxes();
        syncNumbers();
        void paint();
    };
    stage.onpointerup = stage.onpointercancel = () => {
        if (drag) {
            drag = null;
            app.render();
        }
    };
    stage.onkeydown = event => {
        const box = event.target.closest('[data-region]');

        if (document.body.classList.contains('busy') || !box || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { return; }

        event.preventDefault();
        const selectionChanged = regionId !== box.dataset.region;
        regionId = box.dataset.region;
        const r = region(), step = event.shiftKey ? 10 : 1;
        r.x += event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
        r.y += event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
        normalize(r);
        changed();

        if (selectionChanged) { app.render(); } else {
            boxes();
            syncNumbers();
            void paint();
        }

        ui.$('card-regions').querySelector('[data-region="' + regionId + '"]')?.focus({ preventScroll: true });
    };
}
`;
