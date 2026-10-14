import { LIMITS } from "./limits.js";
import { RenderError, resourceLimit, unsupported } from "./errors.js";
import type { RenderResources } from "./resources.js";
import type { T2IRequest, RenderElement, IconName, TextRun } from "./types.js";

export const ICONS: readonly IconName[] = ["check", "cross", "star", "info", "arrow-up", "arrow-down"];
function invalid(message: string): never {
    throw new RenderError("INVALID_INPUT", message);
}
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function number(value: unknown, min: number, max: number, label: string): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
        invalid(`${label}不在支持范围内`);
    }

    return value;
}

function color(value: unknown): string {
    if (typeof value !== "string" || !/^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) {
        invalid("颜色需要使用 #RRGGBB 或 #RRGGBBAA");
    }

    return value;
}

function keys(value: Record<string, unknown>, allowed: string[]) {
    if (Object.keys(value).some(key => !allowed.includes(key))) {
        invalid("包含未知的请求字段");
    }
}

export function validateRequest(input: unknown, resources: RenderResources): T2IRequest {
    if (!isRecord(input) || typeof input.background !== "string" || !Array.isArray(input.elements)) {
        invalid("需要提供内置背景标识和绘制元素");
    }

    keys(input, ["background", "elements"]);
    const background = resources.backgroundInfo(input.background);

    if (input.elements.length > LIMITS.maxElements) {
        resourceLimit("绘制元素过多");
    }

    let textLength = 0;
    const elements: RenderElement[] = Array.from(input.elements, (element: unknown) => {
        if (!isRecord(element)) {
            invalid("绘制元素格式不正确");
        }

        const region = element.region;

        if (region !== undefined && (typeof region !== "string" || !background.regions || !Object.hasOwn(background.regions, region))) {
            invalid("未找到背景中的固定区域");
        }

        if (background.regions && region === undefined) {
            invalid("该背景需要指定固定区域");
        }

        const bounds = typeof region === "string" ? background.regions![region]! : background;
        const position = { ...(typeof region === "string" ? { region } : {}), x: number(element.x, 0, bounds.width, "横坐标"), y: number(element.y, 0, bounds.height, "纵坐标") };
        const { x } = position;
        const size = number(element.size ?? 24, 1, element.type === "text" ? LIMITS.maxFontSize : LIMITS.maxDimension, "大小");

        if (element.type === "text") {
            keys(element, ["type", "text", "runs", "region", "x", "y", "size", "color", "weight", "align", "maxWidth", "lineHeight"]);

            if (Object.hasOwn(element, "text") === Object.hasOwn(element, "runs")) {
                invalid("text 和 runs 需要且只能提供一种");
            }

            let previousCR = false;
            function content(value: unknown): string {
                if (typeof value !== "string" || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
                    invalid("文字必须是有效文本");
                }

                textLength += value.length;
                const raw = previousCR && value.startsWith("\n") ? value.slice(1) : value;

                if (value.length) {
                    previousCR = value.endsWith("\r");
                }

                return raw.replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
            }
            let payload: { text: string } | { runs: TextRun[] };

            if (Object.hasOwn(element, "text")) {
                payload = { text: content(element.text) };
            } else {
                if (!Array.isArray(element.runs)) {
                    invalid("runs 需要是文字分段数组");
                }

                payload = {
                    runs: Array.from(element.runs, (run: unknown) => {
                        if (!isRecord(run)) {
                            invalid("文字分段格式不正确");
                        }

                        keys(run, ["text", "color"]);
                        return { text: content(run.text), ...(run.color === undefined ? {} : { color: color(run.color) }) };
                    })
                };
            }

            const weight = element.weight ?? 400;
            const align = element.align ?? "left";

            if (weight !== 400 && weight !== 700) {
                unsupported("仅支持常规和粗体字重");
            }

            if (align !== "left" && align !== "center" && align !== "right") {
                invalid("文字对齐方式不正确");
            }

            return {
                type: "text", ...payload, ...position, size,
                color: color(element.color ?? "#ffffff"), weight, align,
                maxWidth: number(element.maxWidth ?? (region === undefined ? background.width : align === "left" ? bounds.width - x : align === "right" ? x : 2 * Math.min(x, bounds.width - x)), 1, bounds.width, "换行宽度"),
                lineHeight: number(element.lineHeight ?? size * 1.3, size, LIMITS.maxDimension, "行高")
            };
        }

        if (element.type === "emoji") {
            keys(element, ["type", "value", "region", "x", "y", "size"]);

            if (typeof element.value !== "string" || element.value.length === 0) {
                invalid("需要提供 Emoji");
            }

            textLength += element.value.length;
            return { type: "emoji", value: element.value, ...position, size };
        }

        if (element.type === "icon") {
            keys(element, ["type", "name", "region", "x", "y", "size", "color"]);

            if (!ICONS.includes(element.name as IconName)) {
                unsupported("未找到内置图标");
            }

            return { type: "icon", name: element.name as IconName, ...position, size, color: color(element.color ?? "#ffffff") };
        }

        return unsupported("不支持的绘制元素类型");
    });

    const normalizedLength = elements.reduce((total, element) => total + (element.type === "text" ? (element.text !== undefined ? element.text.length : element.runs.reduce((sum, run) => sum + run.text.length, 0)) : element.type === "emoji" ? element.value.length : 0), 0);

    if (textLength > LIMITS.maxTextLength || normalizedLength > LIMITS.maxTextLength) {
        resourceLimit("文字过长");
    }

    const request = { background: input.background, elements };

    if (new TextEncoder().encode(JSON.stringify(request)).length > LIMITS.maxInputBytes) {
        resourceLimit("请求内容过大");
    }

    return request;
}
