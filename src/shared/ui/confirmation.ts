export const confirmation = String.raw`
function createConfirmation(ui) {
    const { $ } = ui;
    let confirming = false;

    async function visibleArea() {
        const probe = document.createElement('div');
        probe.className = 'viewport-probe';
        document.body.append(probe);

        return new Promise((resolve) => {
            const observer = new IntersectionObserver(([entry]) => {
                observer.disconnect();
                probe.remove();
                const rect = entry.intersectionRect, viewport = window.visualViewport;
                const left = Math.max(rect.left, viewport?.offsetLeft || 0), top = Math.max(rect.top, viewport?.offsetTop || 0);
                const right = Math.min(rect.right, viewport ? viewport.offsetLeft + viewport.width : innerWidth);
                const bottom = Math.min(rect.bottom, viewport ? viewport.offsetTop + viewport.height : innerHeight);
                resolve({ left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
            });
            observer.observe(probe);
        });
    }

    return async function confirmAction(message) {
        if (confirming) { return false; }

        confirming = true;
        let stop = () => { };

        try {
            const trigger = document.activeElement, area = await visibleArea();

            if (!area.width || !area.height) { return false; }

            const dialog = $('decision'), scroll = { x: window.scrollX, y: window.scrollY };
            $('decisionText').textContent = message;
            const destructive = /删除|清空/.test(message);
            $('decisionAccept').className = destructive ? 'destructive' : 'primary';
            $('decisionAccept').textContent = destructive ? '确认删除' : /放弃|撤销/.test(message) ? '放弃修改' : '确定';
            $('decisionAccept').disabled = false;
            $('decisionCancel').disabled = false;

            const position = bounds => {
                if (!bounds.width || !bounds.height) { return; }

                for (const [key, value] of Object.entries({ top: bounds.top + bounds.height / 2, left: bounds.left + bounds.width / 2, width: bounds.width, height: bounds.height })) {
                    dialog.style.setProperty('--decision-' + key, value + 'px');
                }
            };
            position(area);
            let frame, revision = 0;
            const resize = () => {
                const current = ++revision;
                cancelAnimationFrame(frame);
                frame = requestAnimationFrame(async () => {
                    const bounds = await visibleArea();

                    if (dialog.open && current === revision) { position(bounds); }
                });
            };
            window.addEventListener('resize', resize);
            window.visualViewport?.addEventListener('resize', resize);
            window.visualViewport?.addEventListener('scroll', resize);
            // 与 Points 相同，仅在弹窗打开时读取宿主裁切范围，不发请求
            const timer = setInterval(() => { if (!document.hidden) { resize(); } }, 100);
            stop = () => {
                revision++;
                cancelAnimationFrame(frame);
                clearInterval(timer);
                window.removeEventListener('resize', resize);
                window.visualViewport?.removeEventListener('resize', resize);
                window.visualViewport?.removeEventListener('scroll', resize);
            };
            dialog.showModal();
            $('decisionCancel').focus({ preventScroll: true });
            window.scrollTo(scroll.x, scroll.y);

            return await new Promise((resolve) => {
                const close = (accepted) => {
                    dialog.close();
                    $('decisionAccept').onclick = null;
                    $('decisionCancel').onclick = null;
                    dialog.onclick = null;
                    dialog.oncancel = null;

                    if (trigger?.isConnected && !trigger.disabled && (document.activeElement === document.body || document.activeElement?.disabled)) { trigger.focus({ preventScroll: true }); }

                    resolve(accepted);
                };
                $('decisionAccept').onclick = () => close(true);
                $('decisionCancel').onclick = () => close(false);
                dialog.onclick = event => {
                    if (event.target !== dialog) { return; }

                    const rect = dialog.getBoundingClientRect();

                    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) { close(false); }
                };
                dialog.oncancel = (event) => {
                    event.preventDefault();
                    close(false);
                };
            });
        } finally {
            stop();
            confirming = false;
        }
    };
}
`;
