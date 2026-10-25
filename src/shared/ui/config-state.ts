export const configState = String.raw`
function checkedConfigState(value, previous, full = false) {
    const object = item => !!item && typeof item === 'object' && !Array.isArray(item);
    const invalid = () => { throw Error('配置响应格式错误，请重新加载'); };

    if (!object(value) || !Number.isSafeInteger(value.revision) || value.revision < 1 || !object(value.config)
        || !Number.isSafeInteger(value.config.schemaVersion) || value.config.schemaVersion < 1) { invalid(); }

    if (previous && value.config.schemaVersion !== previous.config.schemaVersion) { invalid(); }

    for (const [key, prior] of Object.entries(previous?.config || {})) {
        if (key === 'buttons' || key === 'cardDesigns') { continue; }

        const next = value.config[key];

        if (Array.isArray(prior) ? !Array.isArray(next) : object(prior) ? !object(next) : typeof next !== typeof prior) { invalid(); }
    }

    if (full && !value.copyEditor && !value.settings) { invalid(); }

    const state = { ...previous, ...value };

    if (state.copyEditor !== undefined) {
        const declaration = state.copyEditor;

        if (!object(declaration) || !object(declaration.fields) || !Object.keys(declaration.fields).length
            || !Array.isArray(declaration.views) || !declaration.views.length || !Array.isArray(declaration.outputs)
            || !Array.isArray(declaration.samples) || !declaration.samples.length
            || previous?.copyEditor && declaration.id !== previous.copyEditor.id) { invalid(); }

        function ids(items) {
            if (items.some(item => !object(item) || typeof item.id !== 'string' || !item.id)) { invalid(); }

            const keys = new Set(items.map(item => item.id));

            if (keys.size !== items.length) { invalid(); }

            return keys;
        }

        const samples = ids(declaration.samples), outputs = ids(declaration.outputs), views = ids(declaration.views);
        const references = (items, keys) => Array.isArray(items) && items.length > 0
            && items.every(key => typeof key === 'string' && keys.has(key));

        if (!views.has(declaration.initial) || declaration.samples.some(sample => typeof sample.name !== 'string')
            || declaration.outputs.some(output => typeof output.name !== 'string')) { invalid(); }

        for (const field of Object.values(declaration.fields)) {
            if (!object(field) || field.optional !== undefined && typeof field.optional !== 'boolean' || !Array.isArray(field.path) || !field.path.length || field.path.some(key => typeof key !== 'string')
                || !object(field.variables) || !references(field.samples, samples)
                || typeof field.path.reduce((current, key) => current?.[key], state.config) !== 'string' && !(field.optional && field.path.reduce((current, key) => current?.[key], state.config) === undefined)) { invalid(); }
        }

        if (declaration.views.some(view => !references(view.keys, new Set(Object.keys(declaration.fields)))
            || !references(view.targets, outputs) || view.samples !== undefined && (!references(view.samples, samples)
                || view.keys.some(key => !declaration.fields[key].samples.some(id => view.samples.includes(id)))))) { invalid(); }
    }

    if (state.settings !== undefined) {
        const declaration = state.settings;

        if (!object(declaration) || !Array.isArray(declaration.fields) || previous?.settings && declaration.id !== previous.settings.id) { invalid(); }

        for (const field of declaration.fields) {
            const actual = state.config[field.key];
            const type = field.type === 'checkbox' ? 'boolean' : field.type === 'number' || field.valueType === 'number' ? 'number' : 'string';

            if (typeof actual !== type || type === 'number' && !Number.isFinite(actual)
                || field.min !== undefined && actual < field.min || field.max !== undefined && actual > field.max
                || field.secret && typeof state[field.secret.saved] !== 'boolean'
                || field.type === 'select' && (!Array.isArray(field.options) || !field.options.some(option => option.id === String(actual)))) { invalid(); }
        }
    }

    if (state.config.buttons !== undefined && (!object(state.config.buttons)
        || Object.values(state.config.buttons).some(rows => messageButtonError(rows)))) { invalid(); }

    return state;
}
`;
