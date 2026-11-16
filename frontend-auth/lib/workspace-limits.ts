// Azure adapter logical payload cap, UTF-8 bytes, not JS character count.
// Does not change the current Site's legacy storage limit.
export const WORKSPACE_MAX_BYTES = 1_700_000;
export const BACKUP_MAX_BYTES = 1_750_000;
export const REQUEST_MAX_BYTES = BACKUP_MAX_BYTES;
export const WORKSPACE_LIMIT_MESSAGE = 'Workspace exceeds the current-only limit (1,700,000 UTF-8 bytes).';
export const BACKUP_LIMIT_MESSAGE = 'Backup exceeds the 1,750,000 UTF-8 byte limit.';
export function jsonBytes(value: unknown): number {return new TextEncoder().encode(JSON.stringify(value)).byteLength;}
