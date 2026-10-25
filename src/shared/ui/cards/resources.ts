export const cardResources = String.raw`
    async function image(url) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        await img.decode();

        return img;
    }

    function loadFonts(weights) {
        for (const weight of weights) {
            if (fonts.has(weight) || fontLoads.has(weight) || failedFonts.has(weight) || !state?.fonts[weight === 400 ? 'regular' : 'bold']) { continue; }

            const current = generation, font = new FontFace('DailyCard' + weight, 'url("' + assetURL(cardFontNames[weight]) + '")');
            fontLoads.set(weight, font.load().then(() => {
                document.fonts.add(font);
                fonts.add(weight);

                if (current === generation) { void paint(); }
            }).catch(() => {
                failedFonts.add(weight);

                if (current === generation && ui.$('card-font-status')) {
                    app.status('字体加载失败，请重新加载字体', true);
                    ui.$('card-editor').querySelector('[data-action="card-fonts"]').textContent = '重新加载字体';
                }
            }).finally(() => fontLoads.delete(weight)));
        }
    }

    function clearPending(id) {
        const entry = pending.get(id);

        if (entry) {
            URL.revokeObjectURL(entry.url);
            pending.delete(id);
        }
    }

    async function localBackground(file) {
        if (!file) { return; }

        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10_000_000) { throw Error('请选择 10 MB 以内的 PNG、JPEG 或 WebP'); }

        const id = selected, d = definition(), current = generation;
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        canvas.width = 540;
        canvas.height = d.height;
        const scale = Math.max(540 / bitmap.width, canvas.height / bitmap.height);
        canvas.getContext('2d').drawImage(bitmap, (540 - bitmap.width * scale) / 2, (canvas.height - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
        bitmap.close();
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

        if (current !== generation) { return; }

        if (!blob || blob.size > 2_000_000) { throw Error('处理后的背景超过 2 MB，请换一张图片'); }

        clearPending(id);
        pending.set(id, { blob, url: URL.createObjectURL(blob) });
        draft[id].background = 'local:' + crypto.randomUUID();
        draft[id].enabled = true;
        changed(false);
        backgroundAsset = '';
        app.render();
        app.status('图片仅在本地，保存或真实预览时上传');
    }

    async function uploadPending(id) {
        const entry = pending.get(id);

        if (!entry) { return; }

        const result = await (await request('background?card=' + id, entry.blob, true)).json();
        draft[id].background = result.asset;
        clearPending(id);
        backgroundAsset = '';
    }

    function revokePreview() {
        if (realURL) {
            URL.revokeObjectURL(realURL);
            realURL = '';
        }

        realStale = false;
    }

`;
