/** 用户编写的 Markdown 片段仅展开一次，外部值先转义 */
export function expand(body: string, values: Record<string, string>, fragments: Record<string, string> = {}) {
    return body.replace(/\{\{([^{}]+)\}\}/g, (_, key: string) =>
        Object.hasOwn(fragments, key)
            ? fragments[key]!
            : (Object.hasOwn(values, key) ? values[key]! : "").replace(/([\\`*_{}[\]()<>#+.!|~-])/g, "\\$1"),
    );
}

/** 命令参数仅编码一次，外部标签转义后再嵌入 Markdown */
export function commandUrl(command: string, enter = true) {
    const encoded = encodeURIComponent(command).replace(/[!'()*]/g, (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase());

    return "mqqapi://aio/inlinecmd?command=" + encoded + "&enter=" + enter + "&reply=false";
}

export function commandLink(label: string, command: string, enter = true) {
    return "[" + expand("{{label}}", { label }) + "](" + commandUrl(command, enter) + ")";
}

/** 仅在实际有输出的条目之间插入间隔，条目本身的空白原样保留 */
export function joinItems(items: readonly string[], separator = ""): string {
    return items.filter(item => item.trim()).join(separator);
}
