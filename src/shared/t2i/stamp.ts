import type { PNGCanvas } from "./png-template.js";
import type { Pixels } from "./resources.js";

export type Color = readonly [number, number, number, number];
export function parseColor(hex: string): Color {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1];
}
function over(row: Uint8Array, pos: number, red: number, green: number, blue: number, alpha: number, channels: 3 | 4) {
    if (alpha <= 0) {
        return;
    }

    if (alpha === 1) {
        row[pos] = Math.round(red); row[pos + 1] = Math.round(green); row[pos + 2] = Math.round(blue);

        if (channels === 4) {
            row[pos + 3] = 255;
        }

        return;
    }

    if (channels === 3 || row[pos + 3]! === 255) {
        const remain = 1 - alpha;
        row[pos] = Math.round(red * alpha + row[pos]! * remain);
        row[pos + 1] = Math.round(green * alpha + row[pos + 1]! * remain);
        row[pos + 2] = Math.round(blue * alpha + row[pos + 2]! * remain);
        return;
    }

    const remain = row[pos + 3]! / 255 * (1 - alpha), outAlpha = alpha + remain;
    row[pos] = Math.round((red * alpha + row[pos]! * remain) / outAlpha);
    row[pos + 1] = Math.round((green * alpha + row[pos + 1]! * remain) / outAlpha);
    row[pos + 2] = Math.round((blue * alpha + row[pos + 2]! * remain) / outAlpha);
    row[pos + 3] = Math.round(outAlpha * 255);
}

/** 灰度字形和可着色图标；整数坐标直接盖印，小数坐标使用双线性覆盖率 */
export function stampMask(canvas: PNGCanvas, mask: Pixels, x: number, y: number, color: Color, width = mask.width, height = mask.height) {
    if (color[3]! === 0) {
        return;
    }

    const left = Math.max(0, Math.floor(x)), right = Math.min(canvas.width, Math.ceil(x + width));
    const top = Math.max(0, Math.floor(y)), bottom = Math.min(canvas.height, Math.ceil(y + height));
    const direct = Number.isInteger(x) && Number.isInteger(y) && width === mask.width && height === mask.height;
    canvas.touch(x, y, width, height);

    for (let dy = top; dy < bottom; dy++) {
        const row = canvas.row(dy);

        if (direct) {
            let source = (dy - y) * mask.width + left - x;
            let target = left * canvas.channels;

            for (let dx = left; dx < right; dx++, source++, target += canvas.channels) {
                const alpha = mask.data[source]!;

                if (alpha) { over(row, target, color[0]!, color[1]!, color[2]!, alpha / 255 * color[3]!, canvas.channels); }
            }

            continue;
        }

        const sy = (dy - y + 0.5) * mask.height / height - 0.5, y0 = Math.floor(sy), fy = sy - y0;

        for (let dx = left; dx < right; dx++) {
            const sx = (dx - x + 0.5) * mask.width / width - 0.5, x0 = Math.floor(sx), fx = sx - x0;
            let alpha = 0;

            for (let j = 0; j < 2; j++) {
                for (let i = 0; i < 2; i++) {
                    const px = x0 + i, py = y0 + j;

                    if (px >= 0 && py >= 0 && px < mask.width && py < mask.height) {
                        alpha += mask.data[py * mask.width + px]! * (i ? fx : 1 - fx) * (j ? fy : 1 - fy);
                    }
                }
            }

            over(row, dx * canvas.channels, color[0]!, color[1]!, color[2]!, alpha / 255 * color[3]!, canvas.channels);
        }
    }
}

export function stampEmoji(canvas: PNGCanvas, source: Pixels, x: number, y: number, size: number) {
    const left = Math.max(0, Math.floor(x)), right = Math.min(canvas.width, Math.ceil(x + size));
    const top = Math.max(0, Math.floor(y)), bottom = Math.min(canvas.height, Math.ceil(y + size));
    const direct = Number.isInteger(x) && Number.isInteger(y) && size === source.width && size === source.height;
    canvas.touch(x, y, size, size);

    for (let dy = top; dy < bottom; dy++) {
        const row = canvas.row(dy);

        if (direct) {
            let sourcePos = ((dy - y) * source.width + left - x) * 4;
            let target = left * canvas.channels;

            for (let dx = left; dx < right; dx++, sourcePos += 4, target += canvas.channels) {
                const alpha = source.data[sourcePos + 3]!;

                if (alpha) { over(row, target, source.data[sourcePos]!, source.data[sourcePos + 1]!, source.data[sourcePos + 2]!, alpha / 255, canvas.channels); }
            }

            continue;
        }

        const sy = Math.max(0, Math.min(source.height - 1, (dy - y + 0.5) * source.height / size - 0.5));
        const y0 = Math.floor(sy), fy = sy - y0;

        for (let dx = left; dx < right; dx++) {
            const sx = Math.max(0, Math.min(source.width - 1, (dx - x + 0.5) * source.width / size - 0.5));
            const x0 = Math.floor(sx), fx = sx - x0;
            let alpha = 0, red = 0, green = 0, blue = 0;

            for (let j = 0; j < 2; j++) {
                for (let i = 0; i < 2; i++) {
                    const pos = (Math.min(y0 + j, source.height - 1) * source.width + Math.min(x0 + i, source.width - 1)) * 4;
                    const weight = source.data[pos + 3]! / 255 * (i ? fx : 1 - fx) * (j ? fy : 1 - fy);
                    alpha += weight; red += source.data[pos]! * weight; green += source.data[pos + 1]! * weight; blue += source.data[pos + 2]! * weight;
                }
            }

            if (alpha > 0) {
                over(row, dx * canvas.channels, red / alpha, green / alpha, blue / alpha, alpha, canvas.channels);
            }
        }
    }
}
