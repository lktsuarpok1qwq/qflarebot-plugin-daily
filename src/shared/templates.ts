export function validateTemplate(body: string, keys: readonly string[]) {
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(body)) {
        throw new Error("文字包含不支持的控制字符");
    }

    const rest = body.replace(/\{\{([^{}]+)\}\}/g, (_, key: string) => {
        if (!keys.includes(key)) {
            throw new Error(`未知变量：${key}`);
        }

        return "";
    });

    if (rest.includes("{{") || rest.includes("}}")) {
        throw new Error("变量格式错误");
    }
}
export function validateCopyText(value: unknown, field: { label: string; variables: readonly string[]; allowEmpty?: boolean }): asserts value is string {
    if (typeof value !== "string" || (!field.allowEmpty && !value.trim())) {
        throw new Error(field.label + "格式或长度错误");
    }

    validateTemplate(value, field.variables);
}
