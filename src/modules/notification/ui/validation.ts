export const notificationValidation = String.raw`
const notificationStatuses = { sending: '发送中', success: '发送成功', failed_api: '平台拒绝', failed_validation: '内容无效', uncertain: '结果不确定', skipped_empty: '空内容跳过', skipped_expired: '已过期', skipped_budget: '超出发送预算', skipped_disabled: '已停用' };

function checkNotificationState(state) {
    const c = state.config, object = value => value && typeof value === 'object' && !Array.isArray(value);
    const invalid = () => { throw Error('通知配置响应格式错误，请重新加载'); };
    const text = value => typeof value === 'string' && value.length > 0;
    const ids = rows => Array.isArray(rows) && rows.every(row => object(row) && text(row.id)) && new Set(rows.map(row => row.id)).size === rows.length;

    if (typeof c.paused !== 'boolean' || ![7, 30, 90].includes(c.retentionDays) || !['tasks', 'templates', 'recipients'].every(key => ids(c[key])) || !Array.isArray(c.bindings)
        || typeof state.botId !== 'string' || typeof state.currentBotId !== 'string') { invalid(); }

    const tasks = new Set(c.tasks.map(row => row.id)), templates = new Set(c.templates.map(row => row.id)), recipients = new Set(c.recipients.map(row => row.id));

    for (const row of c.tasks) {
        const s = row.schedule;

        if (!text(row.name) || typeof row.enabled !== 'boolean' || !['system', 'manual'].includes(row.origin) || !templates.has(row.templateId)
            || !object(s) || !['daily', 'weekly', 'once'].includes(s.kind) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time)
            || s.kind === 'once' && (typeof s.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.date) || !Number.isFinite(Date.parse(s.date)) || new Date(s.date).toISOString().slice(0, 10) !== s.date)
            || s.kind === 'weekly' && (!Array.isArray(s.weekdays) || !s.weekdays.length || s.weekdays.some(day => !Number.isInteger(day) || day < 1 || day > 7))) { invalid(); }
    }

    if (c.templates.some(row => !text(row.name) || typeof row.body !== 'string' || row.buttons !== undefined && messageButtonError(row.buttons))
        || c.recipients.some(row => !text(row.name) || !text(row.botId) || !text(row.openid) || !['group', 'c2c'].includes(row.scene) || typeof row.enabled !== 'boolean')
        || c.bindings.some(row => !object(row) || !tasks.has(row.taskId) || !recipients.has(row.recipientId))
        || state.cursors !== null && (!Array.isArray(state.cursors) || state.cursors.some(row => !object(row) || !tasks.has(row.task_id) || row.due_at !== null && !Number.isSafeInteger(row.due_at)))
        || state.jobs !== null && !Array.isArray(state.jobs)) { invalid(); }

    if (!object(state.limits) || ['tasks', 'templates', 'recipients', 'bindings'].some(key => !Number.isSafeInteger(state.limits[key]) || state.limits[key] < 1)
        || !object(state.draftDefaults) || !object(state.draftDefaults.template) || typeof state.draftDefaults.template.name !== 'string' || typeof state.draftDefaults.template.body !== 'string'
        || !object(state.draftDefaults.task) || typeof state.draftDefaults.task.name !== 'string' || !object(state.variableDescriptions) || !Array.isArray(state.variables) || state.variables.some(key => !text(key))
        || !Array.isArray(state.variableGroups) || !Array.isArray(state.copySamples) || !state.copySamples.length
        || state.copySamples.some(row => !object(row) || !text(row.id) || !text(row.name) || !object(row.values) || Object.values(row.values).some(value => typeof value !== 'string'))) { invalid(); }
}

function checkNotificationCursors(rows) {
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row.task_id !== 'string' || row.due_at !== null && !Number.isSafeInteger(row.due_at))) {
        throw Error('排程响应格式错误，请重新加载');
    }
}

function checkNotificationRecord(row, key) {
    if (!row || typeof row !== 'object' || typeof row.key !== 'string' || key !== undefined && row.key !== key
        || typeof row.task_id !== 'string' || typeof row.recipient_id !== 'string' || !Object.hasOwn(notificationStatuses, row.status)
        || ['due_at', 'claimed_at', 'updated_at'].some(field => !Number.isSafeInteger(row[field]) || row[field] < 0)) {
        throw Error('记录响应格式错误，请重新查询');
    }

    return row;
}

function checkNotificationTest(result) {
    if (!result || typeof result.ok !== 'boolean' || !Object.hasOwn(notificationStatuses, result.status)
        || result.ok !== (result.status === 'success') || result.text !== undefined && typeof result.text !== 'string'
        || result.error !== undefined && result.error !== null && typeof result.error !== 'string') { throw Error('测试结果未确认，请查询本次结果'); }

    return result;
}
`;
