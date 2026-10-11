export const confirmation = String.raw`
function createConfirmation(ui) {
    const { $ } = ui;
    async function visibleArea() {
        const probe = document.createElement('div');
        probe.className = 'viewport-probe';
        document.body.append(probe);
        return new Promise((resolve) => {
            const observer = new IntersectionObserver(([entry]) => {
                observer.disconnect();
                probe.remove();
                resolve(entry.intersectionRect);
            });
            observer.observe(probe);
        });
    }
    return async function confirmAction(message) {
        const area = await visibleArea();

        if (!area.width || !area.height) { return false; }

        const dialog = $('decision'), scroll = { x: window.scrollX, y: window.scrollY };
        $('decisionText').textContent = message;
        $('decisionAccept').disabled = false;
        $('decisionCancel').disabled = false;

        for (const [key, value] of Object.entries({ top: area.top + area.height / 2, left: area.left + area.width / 2, width: area.width, height: area.height })) {
            dialog.style.setProperty('--decision-' + key, value + 'px');
        }

        return new Promise((resolve) => {
            const close = (accepted) => { dialog.close(); resolve(accepted); };
            $('decisionAccept').onclick = () => close(true);
            $('decisionCancel').onclick = () => close(false);
            dialog.oncancel = (event) => { event.preventDefault(); close(false); };
            dialog.showModal();
            $('decisionCancel').focus({ preventScroll: true });
            window.scrollTo(scroll.x, scroll.y);
        });
    };
}
`;
