// Decimal UTF-8 bytes, not JavaScript characters. D1 limits each TEXT/row to
// 2,000,000 bytes; retain 200 KB for the snapshot envelope and row metadata.
// This is a bounded bridge, not a replacement for record-based storage.
export const WORKSPACE_MAX_BYTES = 1_800_000;
export const BACKUP_MAX_BYTES = 1_900_000;
export const REQUEST_MAX_BYTES = BACKUP_MAX_BYTES + 50_000;
export const WORKSPACE_LIMIT_MESSAGE = 'Workspace exceeds the 1.8 MB limit (1,800,000 UTF-8 bytes).';
export const BACKUP_LIMIT_MESSAGE = 'Backup exceeds the 1.9 MB limit (1,900,000 UTF-8 bytes).';

export function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
