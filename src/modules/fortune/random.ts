export function random(seed: string): () => number {
    let state = 2166136261;

    for (let i = 0; i < seed.length; i++) { state = Math.imul(state ^ seed.charCodeAt(i), 16777619); }

    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let value = Math.imul(state ^ state >>> 15, 1 | state);
        value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}
export function validWeights(values: readonly number[]) {
    const total = values.reduce((sum, value) => sum + value, 0);

    if (values.some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0) || !Number.isFinite(total) || total <= 0) {
        throw new Error("权重须为非负有限数，合计须为正且有限");
    }

    return total;
}
export function choose<T extends string | { id: string }>(values: readonly T[], weight: (value: T) => number, rng: () => number): T | undefined {
    const positive = values.filter((value) => weight(value) > 0);
    const id = (value: T) => typeof value === "string" ? value : value.id;

    if (positive.some((value, i) => i > 0 && id(positive[i - 1]!) > id(value))) {
        positive.sort((a, b) => id(a) < id(b) ? -1 : id(a) > id(b) ? 1 : 0);
    }

    if (!positive.length) { return undefined; }

    let cursor = rng() * validWeights(positive.map(weight));

    for (const value of positive) {
        cursor -= weight(value);

        if (cursor < 0) { return value; }
    }

    return positive[positive.length - 1];
}
