export function fields(value: object, allowed: readonly string[]) {
    if (Object.keys(value).some((key) => !allowed.includes(key))) {
        throw new Error("配置包含不支持的字段");
    }
}

export function list(value: unknown, max: number, label: string): asserts value is Record<string, unknown>[] {
    if (
        !Array.isArray(value) ||
        value.length > max ||
        value.some((v) => !v || typeof v !== "object" || Array.isArray(v))
    ) {
        throw new Error(`${label}格式错误或超过 ${max} 条`);
    }
}

export function str(value: unknown, max: number, label: string, empty = false): asserts value is string {
    if (
        typeof value !== "string" ||
        (!empty && !value.trim()) ||
        (max !== Infinity && [...value].length > max) ||
        /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)
    ) {
        throw new Error(`${label}格式或长度错误`);
    }
}

export function bool(value: unknown) {
    if (typeof value !== "boolean") {
        throw new Error("启用状态必须为布尔值");
    }
}
