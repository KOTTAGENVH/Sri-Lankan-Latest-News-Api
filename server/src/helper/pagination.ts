export function clampPage(value: number, max = 10_000): number {
  return Number.isInteger(value) && value > 0 ? Math.min(value, max) : 1;
}
 

export function clampSection(value?: number, max = 1_000): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? Math.min(value, max)
    : undefined;
}
 
export function clampLimit(value: number, max = 100, fallback = 20): number {
  return Number.isInteger(value) && value > 0 ? Math.min(value, max) : fallback;
}
 