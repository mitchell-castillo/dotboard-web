import test from'node:test';import assert from'node:assert/strict';import{WORKSPACE_MAX_BYTES,BACKUP_MAX_BYTES,REQUEST_MAX_BYTES,jsonBytes}from'./lib/workspace-limits.ts';
test('workspace exact UTF8 boundary',()=>assert.equal(jsonBytes('x'.repeat(WORKSPACE_MAX_BYTES-2)),WORKSPACE_MAX_BYTES));
test('workspace +1 byte exceeds cap',()=>assert.equal(jsonBytes('x'.repeat(WORKSPACE_MAX_BYTES-1))>WORKSPACE_MAX_BYTES,true));
test('backup exact boundary and +1',()=>{assert.equal(jsonBytes('x'.repeat(BACKUP_MAX_BYTES-2)),BACKUP_MAX_BYTES);assert.equal(jsonBytes('x'.repeat(BACKUP_MAX_BYTES-1))>BACKUP_MAX_BYTES,true);});
test('nonASCII counts bytes not JS chars and request envelope cap aligns',()=>{assert.equal(jsonBytes('é'),4);assert.equal(REQUEST_MAX_BYTES,4259840);assert.equal(BACKUP_MAX_BYTES-WORKSPACE_MAX_BYTES,65536);});
