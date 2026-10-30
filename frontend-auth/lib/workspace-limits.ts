// Azure adapter logical payload cap, UTF-8 bytes, not JS character count.
// Does not change the current Site's legacy storage limit.
export const WORKSPACE_MAX_BYTES = 4_194_304;
export const BACKUP_MAX_BYTES = WORKSPACE_MAX_BYTES + 65_536;
export const REQUEST_MAX_BYTES = BACKUP_MAX_BYTES;
export const WORKSPACE_LIMIT_MESSAGE = 'Workspace exceeds the 4 MiB limit (4,194,304 UTF-8 bytes).';
export const BACKUP_LIMIT_MESSAGE = 'Backup exceeds the 4,259,840 UTF-8 byte limit.';
export function jsonBytes(value: unknown): number {return new TextEncoder().encode(JSON.stringify(value)).byteLength;}
