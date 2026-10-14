export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
    const bytes = Uint8Array as typeof Uint8Array & { fromBase64?: (value: string) => Uint8Array<ArrayBuffer> };

    if (typeof bytes.fromBase64 === "function") {
        return bytes.fromBase64(value);
    }

    const text = atob(value);
    const data = new Uint8Array(text.length);

    for (let i = 0; i < text.length; i++) {
        data[i] = text.charCodeAt(i);
    }

    return data;
}
