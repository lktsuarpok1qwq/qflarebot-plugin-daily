export const samplePreview = String.raw`
function createSamplePreview(app, ui, settings) {
    const { $, esc } = ui, id = settings.id;
    let selected, timer;
    function current() {
        const samples = settings.samples();
        const sample = samples.find((s) => s.id === selected) || samples[0];
        selected = sample.id;
        return sample;
    }
    function render() {
        const sample = current();
        return '<label>情景<select id="' + id + 'Sample">' + ui.options(settings.samples(), sample.id) + '</select></label>' +
            '<p class="muted">' + esc(settings.sampleHint || '虚构数据，使用当前草稿在本地生成') + '</p>' +
            '<p id="' + id + 'SampleNotice" class="muted" role="status"></p><div id="' + id + 'SampleOutput"></div>';
    }
    function refresh() {
        clearTimeout(timer);

        if (!settings.active() || !$(id + 'SampleOutput')) { return; }

        const token = '\uE000' + crypto.randomUUID(), markers = { start: token + 'S\uE001', end: token + 'E\uE001' };
        let empty = false;
        const mark = (text) => {
            if (!text.trim()) { empty = true; return text; }

            return markers.start + text + markers.end;
        };
        const sample = current(), select = $(id + 'Sample');
        const options = ui.options(settings.samples(), sample.id);

        if (select.innerHTML !== options) { select.innerHTML = options; }

        const results = settings.renderSample(sample, mark);
        const output = $(id + 'SampleOutput');
        output.innerHTML = results.map((result) => (result.label ? '<h3>' + esc(result.label) + '</h3>' : '') +
            '<div class="message-preview">' + (result.text.trim() ? ui.markdown(result.text, markers) : '<span class="muted">当前输出为空</span>') + '</div>').join('');
        highlightSample(output, markers);
        $(id + 'SampleNotice').textContent = !settings.currentValue().trim() ? '当前分支为空，不输出' :
            output.querySelector('.sample-highlight') ? '高亮部分为当前编辑内容' : empty ? '当前情景下没有可显示的内容' : '当前模板未引用此分支';
    }
    return {
        render, refresh, reset() { selected = undefined; },
        input() {
            clearTimeout(timer);

            if (settings.active()) { timer = setTimeout(refresh, 200); }
        },
        change(el) {
            if (el.id !== id + 'Sample') { return false; }

            selected = el.value; refresh(); return true;
        },
        transientInputs: [id + 'Sample'],
    };
}
// Mark text after safe Markdown rendering; markers never become user HTML or saved copy.
function highlightSample(root, markers) {
    const strip = (text) => text.split(markers.start).join('').split(markers.end).join('');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    const nodes = [];

    while (walker.nextNode()) { nodes.push(walker.currentNode); }

    let active = false;

    for (const node of nodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (active && node.tagName === 'HR') { node.classList.add('sample-highlight'); }

            for (const attr of [...node.attributes]) {
                if (attr.value.includes(markers.start) || attr.value.includes(markers.end)) {
                    node.setAttribute(attr.name, strip(attr.value));
                    node.classList.add('sample-highlight');
                }
            }

            continue;
        }

        const chunks = node.textContent.split(new RegExp('(' + markers.start + '|' + markers.end + ')', 'g'));
        const fragment = document.createDocumentFragment();

        for (const chunk of chunks) {
            if (chunk === markers.start) { active = true; continue; }

            if (chunk === markers.end) { active = false; continue; }

            if (!chunk) { continue; }

            const text = document.createTextNode(chunk);

            if (active && chunk.trim()) {
                const mark = document.createElement('mark');
                mark.className = 'sample-highlight'; mark.append(text); fragment.append(mark);
            } else { fragment.append(text); }
        }

        node.replaceWith(fragment);
    }
}
`;
