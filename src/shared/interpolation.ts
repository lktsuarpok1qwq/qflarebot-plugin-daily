/** User-authored Markdown fragments are inserted once; external values are escaped. */
export function expand(body: string, values: Record<string, string>, fragments: Record<string, string> = {}) {
    return body.replace(/\{\{([^{}]+)\}\}/g, (_, key: string) =>
        Object.hasOwn(fragments, key)
            ? fragments[key]!
            : (Object.hasOwn(values, key) ? values[key]! : "").replace(/([\\`*_{}[\]()<>#+.!|~-])/g, "\\$1"),
    );
}

/** Encode command arguments once and keep external labels outside Markdown syntax. */
export function commandUrl(command: string, enter = true) {
    const encoded = encodeURIComponent(command).replace(/[!'()*]/g, (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase());
    return "mqqapi://aio/inlinecmd?command=" + encoded + "&enter=" + enter + "&reply=false";
}
export function commandLink(label: string, command: string, enter = true) {
    return "[" + expand("{{label}}", { label }) + "](" + commandUrl(command, enter) + ")";
}
