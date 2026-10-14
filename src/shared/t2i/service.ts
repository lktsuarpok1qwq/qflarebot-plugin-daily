import { LIMITS } from "./limits.js";
import { RenderError, resourceLimit } from "./errors.js";
import { renderPng } from "./engine.js";
import { validateRequest } from "./validate.js";
import { createResources } from "./resources.js";
import type { T2IAssets } from "./asset-types.js";
import type { T2IService } from "./types.js";

let pending = 0;
let tail = Promise.resolve();

async function acquire(): Promise<() => void> {
    if (pending >= LIMITS.maxPendingRenders) {
        resourceLimit("渲染队列已满");
    }

    pending++;
    const previous = tail;
    let unlock!: () => void;
    tail = new Promise<void>((resolve) => { unlock = resolve; });
    await previous;

    return () => {
        pending--;
        unlock();
    };
}

export function createT2IService(assets: T2IAssets, reportFailure?: (stage: string) => void): T2IService {
    const resources = createResources(assets);
    return {
        backgrounds: resources.listBackgrounds,
        fonts: resources.listFonts,
        async render(input) {
            let release: (() => void) | undefined;
            let stage = "validate";

            try {
                const request = validateRequest(input, resources);
                release = await acquire();
                stage = "render";
                const data = renderPng(request, resources);
                const { width, height } = resources.backgroundInfo(request.background);
                return { ok: true, data, mimeType: "image/png", width, height };
            } catch (error) {
                if (error instanceof RenderError) {
                    return { ok: false, code: error.code, error: error.message };
                }

                try {
                    reportFailure?.(stage);
                } catch {
                    // 日志故障不改变服务结果
                }

                return { ok: false, code: "RENDER_FAILED", error: "图片渲染失败" };
            } finally {
                release?.();
            }
        }
    };
}
