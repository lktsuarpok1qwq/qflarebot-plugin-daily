import type { CalendarEvent } from "../../types.js";
import { validDate } from "../../scheduler/planner.js";
function csv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [],
        field = "",
        quoted = false,
        closed = false;
    const finish = () => {
        row.push(field);
        field = "";
        closed = false;
    };

    for (let i = 0; i < text.length; i++) {
        const char = text[i]!;

        if (quoted) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    quoted = false;
                    closed = true;
                }
            } else {
                field += char;
            }
        } else if (char === ",") {
            finish();
        } else if (char === "\n" || char === "\r") {
            if (char === "\r" && text[i + 1] === "\n") {
                i++;
            }

            finish();
            rows.push(row);
            row = [];
        } else if (char === '"' && !field && !closed) {
            quoted = true;
        } else {
            if (closed || char === '"') {
                throw new Error("CSV 引号位置非法");
            }

            field += char;
        }
    }

    if (quoted) {
        throw new Error("CSV 引号未闭合");
    }

    if (field || row.length || closed) {
        finish();
        rows.push(row);
    }

    return rows;
}
export function importEvents(
    text: string,
    existing: CalendarEvent[],
): {
    batchId: string;
    items: CalendarEvent[];
    duplicates: number;
    conflicts: CalendarEvent[];
} {
    if (new TextEncoder().encode(text).length > 128_000) {
        throw new Error("导入文件超过128KB");
    }

    text = text.replace(/^\uFEFF/, "");
    let input: unknown;

    if (text.trim().startsWith("[")) {
        input = JSON.parse(text);
    } else {
        const rows = csv(text.replace(/^\uFEFF/, "")),
            head = rows.shift();
        const allowed = ["name", "start", "end", "kind", "repeat"];

        if (
            !head ||
            !head.includes("name") ||
            !head.includes("start") ||
            new Set(head).size !== head.length ||
            head.some((key) => !allowed.includes(key))
        ) {
            throw new Error("CSV 必须包含 name,start，可选 end,kind,repeat");
        }

        input = rows
            .filter((r) => r.some(Boolean))
            .map((r) => {
                if (r.length !== head.length) {
                    throw new Error("CSV 列数与表头不一致");
                }

                return Object.fromEntries(head.map((key, i) => [key, r[i]]));
            });
    }

    if (!Array.isArray(input) || input.length > 300) {
        throw new Error("最多导入300条");
    }

    const batchId = crypto.randomUUID(),
        items: CalendarEvent[] = [],
        conflicts: CalendarEvent[] = [];
    let duplicates = 0;

    for (const value of input as unknown[]) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new Error("事件须为对象");
        }

        const x = value as Record<string, unknown>;
        const start = x.start;
        const end = x.end === undefined || x.end === "" ? start : x.end;
        const kind = x.kind === undefined || x.kind === "" ? "event" : x.kind;
        const repeat = x.repeat === undefined || x.repeat === "" ? "once" : x.repeat;

        if (
            Object.keys(x).some((key) => !["name", "start", "end", "kind", "repeat"].includes(key)) ||
            typeof x.name !== "string" ||
            !x.name.trim() ||
            [...x.name].length > 80 ||
            /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(x.name) ||
            typeof start !== "string" ||
            typeof end !== "string" ||
            !validDate(start) ||
            !validDate(end) ||
            end < start
        ) {
            throw new Error("事件名称或日期非法");
        }

        if (
            (kind !== "holiday" && kind !== "makeup" && kind !== "event") ||
            (repeat !== "once" && repeat !== "yearly") ||
            (kind !== "holiday" && end !== start) ||
            (repeat === "yearly" && kind !== "event")
        ) {
            throw new Error("日历类别或重复方式错误");
        }

        if (
            [...existing, ...items].some(
                (h) =>
                    h.kind === kind && h.repeat === repeat && h.name === x.name && h.start === start && h.end === end,
            )
        ) {
            duplicates++;
            continue;
        }

        const item: CalendarEvent = {
            id: crypto.randomUUID(),
            name: x.name,
            start,
            end,
            kind,
            repeat,
            source: "manual",
            batchId,
        };

        if (
            kind !== "event" &&
            [...existing, ...items].some(
                (h) => (h.kind === "holiday" || h.kind === "makeup") && h.start <= end && h.end >= start,
            )
        ) {
            conflicts.push(item);
        }

        items.push(item);
    }

    return { batchId, items, duplicates, conflicts };
}
