/**
 * Pure byte formatting utility converting raw byte counts to human-readable representations.
 * Handles 0 / null / unknown values gracefully according to Real-Debrid conventions.
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes <= 0) {
    return "UNKNOWN";
  }

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  if (unitIndex === 0) {
    return `${Math.round(size)} B`;
  }

  const precision = size >= 100 ? 0 : size >= 10 ? 1 : 2;
  const numStr = size.toFixed(precision);
  const cleanNum = parseFloat(numStr).toString();

  return `${cleanNum} ${units[unitIndex]}`;
}
