export const samplePreview = String.raw`
function createSamplePreview(app, ui, settings) {
    const { $, esc } = ui, id = settings.id;
    let selected, timer;
    const selections = new Map();
    const context = () => settings.context?.() || "default";

    function choices() {
        const samples = settings.samples();

        if (!$(id + 'Workspace')) { return samples; }

        const groups = new Map();

        for (const sample of samples) {
            const output = settings.renderSample(sample, text => text);
            const key = JSON.stringify([output, settings.previewButtons?.() || settings.buttons?.()?.rows || []]);

            if (!groups.has(key) || sample.id === selections.get(context())) { groups.set(key, sample); }
        }

        return [...groups.values()];
    }

    function current(samples) {
        const sample = samples.find(s => s.id === selections.get(context())) || samples[0];
        selected = sample.id;
        selections.set(context(), selected);

        return sample;
    }

    function tools() {
        const samples = settings.samples(), sample = current(samples);

        return samples.length > 1
            ? '<label>情景<select id="' + id + 'Sample">' + ui.options(samples, sample.id) + '</select></label>'
            : '<p class="muted">情景：' + esc(sample.name) + '</p>';
    }

    function refresh() {
        clearTimeout(timer);

        if (!settings.active() || !$(id + 'SampleOutput')) { return; }

        const token = '\uE000' + crypto.randomUUID(), markers = { start: token + 'S\uE001', end: token + 'E\uE001' };
        let empty = false;
        const mark = (text) => {
            if (!(settings.preserveWhitespace?.() ? text.length : text.trim().length)) {
                empty = true;

                return text;
            }

            return markers.start + text + markers.end;
        };
        const samples = choices(), sample = current(samples), container = $(id + 'SampleTools');
        let select = $(id + 'Sample');

        if (container && (samples.length > 1) !== Boolean(select)) {
            const focused = container.contains(document.activeElement);
            container.innerHTML = samples.length > 1
                ? '<label>情景<select id="' + id + 'Sample">' + ui.options(samples, sample.id) + '</select></label>'
                : '<p class="muted">情景：' + esc(sample.name) + '</p>';
            select = $(id + 'Sample');

            if (focused) { $(id + 'Workspace').querySelector('[data-action="copy-preview-sample"]')?.focus({ preventScroll: true }); }
        } else if (container && !select) { container.querySelector('p').textContent = '情景：' + sample.name; }

        const options = ui.options(samples, sample.id);

        if (select && select.innerHTML !== options) { select.innerHTML = options; }

        const results = settings.renderSample(sample, mark);
        const output = $(id + 'SampleOutput');
        output.innerHTML = results.map((result) => (result.label ? '<h3>' + esc(result.label) + '</h3>' : '') +
            '<div class="message-preview">' + (result.text.trim() ? ui.markdown(result.text, markers) : '<span class="muted">当前输出为空</span>') + '</div>').join('');

        $(id + 'SampleNotice').textContent = !(settings.preserveWhitespace?.() ? settings.currentValue().length : settings.currentValue().trim().length) ? '当前分支为空，不输出' :
            output.querySelector('mark,.sample-highlight') ? '高亮部分为当前编辑内容' : empty ? '当前情景下没有可显示的内容' : '当前模板未引用此分支';
        settings.afterPaint?.();
    }

    return {
        tools, refresh,
        render: () => '<div id="' + id + 'SampleOutput" class="sample-output"></div>',
        hint: () => esc(settings.sampleHint || '虚构数据，使用当前草稿在本地生成'),
        notice: () => '<p id="' + id + 'SampleNotice" class="muted" role="status"></p>',
        input() {
            clearTimeout(timer);

            if (settings.active()) {
                if (settings.currentValue().length > 4000) { timer = setTimeout(refresh, 200); } else { refresh(); }
            }
        },
        change(el) {
            if (el.id !== id + 'Sample') { return false; }

            selected = el.value;
            selections.set(context(), selected);
            refresh();

            return true;
        },
        transientInputs: [id + 'Sample'],
    };
}
`;
