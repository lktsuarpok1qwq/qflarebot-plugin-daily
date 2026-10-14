import type { T2IErrorCode } from "./types.js";

export class RenderError extends Error {
    constructor(readonly code: T2IErrorCode, message: string) {
        super(message);
        this.name = "RenderError";
    }
}

export function unsupported(message = "包含不支持的绘制内容"): never {
    throw new RenderError("UNSUPPORTED_CONTENT", message);
}

export function resourceLimit(message: string): never {
    throw new RenderError("RESOURCE_LIMIT", message);
}
