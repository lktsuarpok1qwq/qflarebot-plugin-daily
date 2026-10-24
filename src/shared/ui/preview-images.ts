// 图片只在明确点击后请求；已创建的图片节点按地址及出现次序驻留本页，重绘不重复设置 src。
export const previewImages = String.raw`
function createPreviewImages(getRoot) {
    const cache = new Map();

    function slots() {
        const root = getRoot();

        if (!root) { return []; }

        const occurrences = new Map();

        return [...root.querySelectorAll('[data-preview-src]')].filter(slot => !slot.closest('[hidden]')).map(slot => {
            const url = slot.dataset.previewSrc, index = occurrences.get(url) || 0;
            occurrences.set(url, index + 1);

            return { slot, key: url + '\n' + index, url };
        });
    }

    function restore() {
        const root = getRoot();

        if (!root) { return; }

        for (const { slot, key } of slots()) {
            const state = cache.get(key), control = slot.querySelector('[data-image-load]');
            control.toggleAttribute('data-locked', state?.status === 'pending');
            control.setAttribute('data-managed-disabled', '');
            control.disabled = !!root.closest('[aria-busy="true"]') || state?.status === 'pending';

            if (!state) { continue; }

            control.hidden = state.status === 'loaded';
            control.textContent = state.status === 'pending' ? '图片加载中…' : '重新加载图片';

            if (state.status !== 'error') {
                state.image.alt = slot.dataset.previewAlt;

                for (const name of ['width', 'height']) {
                    const value = slot.dataset['preview' + name[0].toUpperCase() + name.slice(1)];

                    if (value) { state.image.setAttribute(name, value); } else { state.image.removeAttribute(name); }
                }

                slot.querySelector('[data-image-content]').replaceChildren(state.image);
            }
        }
    }

    document.addEventListener('click', event => {
        const root = getRoot();

        if (!root || !root.contains(event.target)) { return; }

        const button = event.target.closest('[data-image-load]');

        if (!button || button.disabled) { return; }

        const target = slots().find(item => item.slot.contains(button));

        if (!target || !/^https?:\/\//i.test(target.url)) { return; }

        const image = document.createElement('img'), state = { image, status: 'pending' };
        image.referrerPolicy = 'no-referrer';

        cache.set(target.key, state);
        image.onload = () => {
            state.status = 'loaded';
            restore();
        };
        image.onerror = () => {
            state.status = 'error';
            restore();
        };
        image.src = target.url;
        restore();
    });

    return restore;
}
`;
