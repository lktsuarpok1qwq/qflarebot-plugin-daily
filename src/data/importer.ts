import type { Holiday } from "../types.js";
import { validDate } from "../scheduler/planner.js";
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
      } else field += char;
    } else if (char === ",") finish();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      finish();
      rows.push(row);
      row = [];
    } else if (char === '"' && !field && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error("CSV 引号位置非法");
      field += char;
    }
  }
  if (quoted) throw new Error("CSV 引号未闭合");
  if (field || row.length || closed) {
    finish();
    rows.push(row);
  }
  return rows;
}
export function importHolidays(
  text: string,
  existing: Holiday[],
): {
  batchId: string;
  items: Holiday[];
  duplicates: number;
  conflicts: Holiday[];
} {
  if (new TextEncoder().encode(text).length > 128_000)
    throw new Error("导入文件超过128KB");
  text = text.replace(/^\uFEFF/, "");
  let input: unknown;
  if (text.trim().startsWith("[")) input = JSON.parse(text);
  else {
    const rows = csv(text.replace(/^\uFEFF/, "")),
      head = rows.shift();
    if (
      head?.join(",") !== "name,start,end" &&
      head?.join(",") !== "name,start"
    )
      throw new Error("CSV 表头须为 name,start,end 或 name,start");
    input = rows
      .filter((r) => r.some(Boolean))
      .map((r) => {
        if (r.length !== head!.length) throw new Error("CSV 列数与表头不一致");
        return { name: r[0], start: r[1], end: r[2] };
      });
  }
  if (!Array.isArray(input) || input.length > 300)
    throw new Error("最多导入300条");
  const batchId = crypto.randomUUID(),
    items: Holiday[] = [],
    conflicts: Holiday[] = [];
  let duplicates = 0;
  for (const x of input) {
    if (
      !x ||
      typeof x.name !== "string" ||
      !x.name.trim() ||
      [...x.name].length > 80 ||
      !validDate(x.start) ||
      !validDate(x.end || x.start) ||
      (x.end || x.start) < x.start
    )
      throw new Error("假期名称或日期非法");
    const end = x.end || x.start;
    if (
      [...existing, ...items].some(
        (h) => h.name === x.name && h.start === x.start && h.end === end,
      )
    ) {
      duplicates++;
      continue;
    }
    const item: Holiday = {
      id: crypto.randomUUID(),
      name: x.name,
      start: x.start,
      end,
      kind: "holiday",
      source: "manual-import",
      batchId,
    };
    if ([...existing, ...items].some((h) => h.start <= end && h.end >= x.start))
      conflicts.push(item);
    items.push(item);
  }
  return { batchId, items, duplicates, conflicts };
}
