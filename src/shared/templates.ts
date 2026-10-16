/** Inspect one template only; offsets are UTF-16 indices, matching textarea selection. */
export function analyzeTemplate(body: string, allowed?: readonly string[]) {
    const keys = new Set<string>();
    let error: { message: string; start: number; end: number } | undefined;
    let end = 0;
    const gap = (start: number, stop: number) => {
        const malformed = /\{\{|\}\}/.exec(body.slice(start, stop));

        if (malformed) { error ??= { message: "变量格式错误", start: start + malformed.index, end: start + malformed.index + 2 }; }
    };
    const control = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.exec(body);

    if (control) { error = { message: "文字包含不支持的控制字符", start: control.index, end: control.index + 1 }; }

    for (const match of body.matchAll(/\{\{([^{}]+)\}\}/g)) {
        gap(end, match.index);
        const key = match[1]!;
        keys.add(key);
        end = match.index + match[0].length;

        if (allowed && !allowed.includes(key)) { error ??= { message: `未知变量：${key}`, start: match.index, end }; }
    }

    gap(end, body.length);
    return { keys, error };
}
export function validateTemplate(body: string, keys: readonly string[]) {
    const result = analyzeTemplate(body, keys);

    if (result.error) { throw Object.assign(new Error(result.error.message), result.error); }

    return result.keys;
}
export function validateCopyText(value: unknown, field: { label: string; variables: readonly string[]; allowEmpty?: boolean }): asserts value is string {
    if (typeof value !== "string" || (!field.allowEmpty && !value.trim())) {
        throw new Error(field.label + "格式或长度错误");
    }

    validateTemplate(value, field.variables);
}
