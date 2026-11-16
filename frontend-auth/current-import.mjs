export const IMPORT_MAX_BYTES=1_750_000;
export function parseCurrentBackup(text){
 if(new TextEncoder().encode(text).length>IMPORT_MAX_BYTES)throw Error('El archivo supera 1,750,000 bytes. No se importó nada.');
 const backup=JSON.parse(text);
 if(!backup||backup.format!=='dot-board-local-backup'||backup.formatVersion!==1||!Number.isSafeInteger(backup.revision)||backup.revision<0||!Array.isArray(backup.workspace?.boards))throw Error('Selecciona un export actual de DotBoard v1 con revisión válida.');
 if(Object.keys(backup).some(k=>!['format','formatVersion','revision','updatedAt','exportedAt','workspace'].includes(k))||['snapshots','versions','history','importedHistory'].some(k=>Object.hasOwn(backup.workspace,k)))throw Error('El archivo contiene campos o versiones históricas no admitidos.');
 return backup;
}
export function makeImportRequest(backup,requestId){return JSON.stringify({requestId,backup});}
