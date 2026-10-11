export const selectPicker = String.raw`
function createSelectPicker() {
    let active, frame;
    function release() {
        cancelAnimationFrame(frame);
        active?.parentElement?.classList.remove('picker-open');
        active = undefined;
    }
    function checkClosed() {
        if (!active) { return; }

        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            if (active && (!active.isConnected || !active.matches(':open'))) { release(); }
        });
    }
    function prepare(el) {
        if (!el || el.disabled || !el.parentElement.classList.contains('select-picker-slot') || el.matches(':open')) { return; }

        release();
        const rect = el.getBoundingClientRect(), slot = el.parentElement;

        for (const [key, value] of Object.entries({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })) {
            slot.style.setProperty('--picker-' + key, value + 'px');
        }

        active = el;
        slot.classList.add('picker-open');
        checkClosed();
    }
    document.addEventListener('pointerdown', (event) => {
        prepare(event.target.closest('select'));
        checkClosed();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === ' ' || event.key === 'Enter' || event.key === 'F4' || event.altKey && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
            prepare(event.target.closest('select'));
        }

        checkClosed();
    });

    for (const event of ['click', 'change', 'keyup', 'focusout']) { document.addEventListener(event, checkClosed); }

    window.addEventListener('blur', release);
    window.addEventListener('resize', release);
    return {
        refresh() {
            release();

            for (const el of document.querySelectorAll('#app select:not([multiple]):not([size])')) {
                if (el.parentElement.classList.contains('select-picker-slot')) { continue; }

                const slot = document.createElement('span');
                slot.className = 'select-picker-slot';
                el.replaceWith(slot);
                slot.append(el);
            }
        },
    };
}
`;
