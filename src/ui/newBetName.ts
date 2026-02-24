export function normalizeBetName(value: string): string {
  return value.trim().replace(/\s+/g, "_").toLowerCase();
}
