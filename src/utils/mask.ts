/**
 * Mask a secret value for safe display in terminal.
 * Shows first 4 characters, rest masked with asterisks.
 * For short values (<= 4 chars), shows only asterisks.
 */
export function maskValue(value: string): string {
  if (value.length <= 4) {
    return "****";
  }
  return `${value.slice(0, 4)}${"*".repeat(Math.min(value.length - 4, 8))}`;
}
