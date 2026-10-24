// SDK 的 SQL 作用域检查不接受 json_each，因此不使用它
export const jsonRows = `WITH RECURSIVE input(data) AS (SELECT ?), idx(i) AS (SELECT 0 FROM input WHERE json_array_length(data)>0 UNION ALL SELECT i+1 FROM idx CROSS JOIN input WHERE i+1<json_array_length(data))`;
export const jx = (key: string) => `json_extract(data, '$[' || i || '].${key}')`;

/** 分别限制每个 D1 绑定值的大小，所有分块仍在同一批事务中执行 */
export function jsonChunks(rows: readonly unknown[], maxBytes = 500_000, maxRows = Infinity): string[] {
    const chunks: string[] = [];
    let items: string[] = [],
        size = 2;

    for (const row of rows) {
        const item = JSON.stringify(row),
            bytes = new TextEncoder().encode(item).length + 1;

        if (bytes > maxBytes) {
            throw new Error("单条数据记录过大");
        }

        if (items.length >= maxRows || size + bytes > maxBytes) {
            chunks.push(`[${items.join(",")}]`);
            items = [];
            size = 2;
        }

        items.push(item);
        size += bytes;
    }

    if (items.length) {
        chunks.push(`[${items.join(",")}]`);
    }

    return chunks;
}
