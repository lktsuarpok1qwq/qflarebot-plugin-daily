export const DAY = 86_400_000;
export const dateAt = (ms: number) => new Date(ms + 8 * 3_600_000).toISOString().slice(0, 10);
export function validDate(s: string): boolean {
    return (
        /^\d{4}-\d{2}-\d{2}$/.test(s) &&
        Number.isFinite(Date.parse(s)) &&
        new Date(s).toISOString().slice(0, 10) === s &&
        +s.slice(0, 4) >= 2000 &&
        +s.slice(0, 4) <= 2199
    );
}
export const at = (date: string, time: string) => Date.parse(`${date}T${time}:00+08:00`);
export const addDays = (date: string, days: number) =>
    new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10);
