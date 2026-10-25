export type Diagnostics = Record<string, string | number | boolean | null>;

export function errorDetails(error: unknown): Diagnostics {
    const detail = error && typeof error === "object" ? error as Record<string, unknown> : {};

    return {
        error: String(error), errorName: error instanceof Error ? error.name : null,
        status: typeof detail.status === "number" ? detail.status : null,
        code: !(error instanceof DOMException) && (typeof detail.code === "string" || typeof detail.code === "number") ? detail.code : null,
        traceId: typeof detail.traceId === "string" ? detail.traceId : null,
        cfRay: typeof detail.cfRay === "string" ? detail.cfRay : null,
    };
}
