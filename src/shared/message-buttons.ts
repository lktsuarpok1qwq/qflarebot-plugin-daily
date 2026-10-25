export type MessageButton = { label: string; action: "command"; data: string; enter: boolean } | { label: string; action: "link"; data: string };
export type MessageButtons = MessageButton[][];
export type ButtonConfiguration = { buttons?: Record<string, MessageButtons> };
export type ButtonError = { message: string; row?: number; item?: number; control?: "label" | "action" | "data" | "enter" };

// 浏览器和服务端共用纯校验，按钮不展开变量或执行表达式。
export function messageButtonError(rows: unknown): ButtonError | null {
    if (!Array.isArray(rows) || rows.length > 5 || rows.some(row => !Array.isArray(row) || row.length < 1 || row.length > 5)) {
        return { message: "按钮最多 5 行，每行 1～5 个；不使用按钮时删除全部行" };
    }

    for (const [row, items] of rows.entries()) {
        for (const [item, value] of items.entries()) {
            const problem = (message: string, control: ButtonError["control"]): ButtonError => ({ message, row, item, control });

            if (!value || typeof value !== "object" || Array.isArray(value) || !["command", "link"].includes(value.action)
                || Object.keys(value).some(key => !["label", "action", "data", ...(value.action === "command" ? ["enter"] : [])].includes(key))) {
                return problem("请选择有效的按钮功能，不提交无关参数", "action");
            }

            if (typeof value.label !== "string" || !value.label.trim() || [...value.label].length > 10 || /[\r\n\u0000-\u001f]/.test(value.label)) {
                return problem("按钮需要 1～10 字的单行文字", "label");
            }

            if (typeof value.data !== "string" || !value.data.trim() || /[\u0000-\u001f]/.test(value.data)) {
                return problem(value.action === "link" ? "请填写链接地址" : "请填写单行命令", "data");
            }

            if (value.action === "command") {
                if (/[{}]/.test(value.data)) { return problem("命令不接受变量", "data"); }

                if (typeof value.enter !== "boolean") { return problem("请选择直接发送或填入输入框", "enter"); }
            } else {
                try {
                    const url = new URL(value.data);

                    if (!/^https?:\/\//i.test(value.data) || !url.hostname || url.username || url.password || /[\s<>"']/.test(value.data)) {
                        return problem("链接按钮请填写有效的 HTTP 或 HTTPS 地址", "data");
                    }
                } catch { return problem("链接按钮请填写有效的 HTTP 或 HTTPS 地址", "data"); }
            }
        }
    }

    return null;
}

export function assertMessageButtons(rows: unknown): asserts rows is MessageButtons {
    const error = messageButtonError(rows);

    if (error) { throw new Error(error.message); }
}
