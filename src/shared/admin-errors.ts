export class AdminError extends Error {
    constructor(public readonly kind: "validation" | "conflict", message: string) {
        super(message);
    }
}

// 仅包装持久化之前执行的同步输入校验
export function validateInput<T>(validate: () => T): T {
    try {
        return validate();
    } catch (error) {
        if (error instanceof AdminError) { throw error; }

        throw new AdminError("validation", error instanceof Error ? error.message : "输入无效");
    }
}
