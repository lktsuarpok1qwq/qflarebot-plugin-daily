export const cardStateValidation = String.raw`
function checkCardDesigns(module, definitions) {
    const state = module?.config?.cardDesigns;
    const invalid = () => { throw Error('卡面响应格式错误，请重新加载'); };

    if (!state || !Number.isSafeInteger(state.revision) || state.revision < 0 || !state.config) { invalid(); }

    for (const definition of definitions) {
        const design = state.config[definition.id];

        if (!design || typeof design.enabled !== 'boolean' || typeof design.background !== 'string' || !Array.isArray(design.regions) || design.regions.length > 24) { invalid(); }

        const ids = new Set();

        for (const region of design.regions) {
            if (!region || typeof region.id !== 'string' || !region.id || ids.has(region.id) || typeof region.field !== 'string'
                || !['left', 'right', 'center'].includes(region.align) || ![400, 700].includes(region.weight) || !/^#[0-9a-f]{6}$/i.test(region.color)
                || ['x', 'y', 'width', 'height', 'size', 'lineHeight'].some(key => !Number.isSafeInteger(region[key]))
                || region.x < 0 || region.y < 0 || region.width < 12 || region.size < 12 || region.size > 72 || region.height < region.size
                || region.x + region.width > definition.width || region.y + region.height > definition.height || region.lineHeight < region.size || region.lineHeight > 100) { invalid(); }

            ids.add(region.id);
            validateRegionContent(region, definition.fields);
        }
    }
}

function checkCardState(value) {
    const invalid = () => { throw Error('卡面响应格式错误，请重新加载'); };
    const list = rows => Array.isArray(rows) && rows.length > 0 && rows.every(row => row && typeof row.id === 'string' && row.id.length > 0) && new Set(rows.map(row => row.id)).size === rows.length;

    if (!value || !list(value.definitions) || !value.fonts || typeof value.fonts.regular !== 'boolean' || typeof value.fonts.bold !== 'boolean'
        || !value.assets || typeof value.assets !== 'object' || Array.isArray(value.assets)) { invalid(); }

    for (const definition of value.definitions) {
        if (typeof definition.title !== 'string' || definition.width !== 540 || ![300, 850].includes(definition.height) || !Array.isArray(definition.fields) || !definition.fields.length
            || definition.fields.some(field => !field || typeof field.key !== 'string' || typeof field.label !== 'string' || typeof field.sample !== 'string')
            || !list(definition.presets) || definition.presets.some(preset => typeof preset.title !== 'string' || !preset.design)
            || !list(definition.samples) || definition.samples.some(sample => typeof sample.title !== 'string' || !sample.values || Object.values(sample.values).some(text => typeof text !== 'string'))) { invalid(); }
    }

    if (Object.values(value.assets).some(asset => !asset || typeof asset.url !== 'string' || ![300, 850].includes(asset.height))) { invalid(); }

    checkCardDesigns(value.module, value.definitions);

    return value;
}
`;
