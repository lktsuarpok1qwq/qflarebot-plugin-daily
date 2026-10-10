/** Keep legacy single keys readable. Multiple coincident events share one delivery. */
export function eventKeys(value: string | null): string[] {
  if (!value) return [];
  return value.startsWith("[") ? (JSON.parse(value) as string[]) : [value];
}
export function packEvents(keys: string[]): string | null {
  const unique = [...new Set(keys)].sort();
  return unique.length > 1 ? JSON.stringify(unique) : (unique[0] ?? null);
}
