import type { Rendered } from "../types.js";

export function imageReply(url: string, label: string, width: number, height: number, caption: string, fallback: () => string): Rendered {
    const text = `![${label} #${width}px #${height}px](${url})${caption ? "\n\n" + caption : ""}`;

    return { text, image: { url, fallback } };
}
