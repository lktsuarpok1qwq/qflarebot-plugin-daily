export class AdminError extends Error {
    constructor(public readonly kind: "validation" | "conflict", message: string) {
        super(message);
    }
}
// Only wrap synchronous input checks performed before persistence.
export function validateInput<T>(validate: () => T): T {
    try {
        return validate();
    } catch (error) {
        if (error instanceof AdminError) { throw error; }

        throw new AdminError("validation", error instanceof Error ? error.message : "输入无效");
    }
}
