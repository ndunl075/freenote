/** "0 B", "12.4 KB", "3.2 MB", "1.5 GB" — one decimal above kilobytes. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  const rounded = i === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[i]}`;
}

/** Whole-number percentage of quota used, clamped to 0–100. */
export function usagePercent(usage: number, quota: number): number {
  if (!Number.isFinite(usage) || !Number.isFinite(quota) || quota <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((usage / quota) * 100)));
}

/** The phrase a user must type to confirm wiping their data. */
export const WIPE_PHRASE = "delete everything";

export function confirmsWipe(input: string): boolean {
  return input.trim().toLowerCase() === WIPE_PHRASE;
}
