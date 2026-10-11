// json_each is intentionally not used: the SDK's SQL scope checker rejects it.
export const jsonRows = `WITH RECURSIVE input(data) AS (SELECT ?), idx(i) AS (SELECT 0 FROM input WHERE json_array_length(data)>0 UNION ALL SELECT i+1 FROM idx CROSS JOIN input WHERE i+1<json_array_length(data))`;
export const jx = (key: string) => `json_extract(data, '$[' || i || '].${key}')`;

/** Bound each D1 value independently; all chunks remain in one batch transaction. */
export function jsonChunks(rows: readonly unknown[], maxBytes = 500_000): string[] {
    const chunks: string[] = [];
    let items: string[] = [],
        size = 2;

    for (const row of rows) {
        const item = JSON.stringify(row),
            bytes = new TextEncoder().encode(item).length + 1;

        if (bytes > maxBytes) {
            throw new Error("单条数据记录过大");
        }

        if (size + bytes > maxBytes) {
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
