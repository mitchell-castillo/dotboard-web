import test from 'node:test';import assert from 'node:assert/strict';
import {actionSchema} from './lib/workspace-store.ts';
import {readFileSync} from 'node:fs';
test('board trash and restore use distinct recoverable operations',()=>{
 assert.equal(actionSchema.safeParse({action:'trash-board',boardId:'b'}).success,true);
 assert.equal(actionSchema.safeParse({action:'restore-board',trashId:'t'}).success,true);
 for(const action of [{action:'trash-board'},{action:'restore-board'},{action:'trash-board',boardId:'b',permanent:true}])assert.equal(actionSchema.safeParse(action).success,false);
});
test('destructive protections stay and confirmation errors are visible',()=>{
 const s=readFileSync(new URL('./app/board-app.tsx',import.meta.url),'utf8');
 assert.ok(s.includes('operation.action.startsWith("delete-")'));
 assert.ok(s.includes('catch(e){setFormError(e instanceof Error?e.message:'));
 assert.ok(s.includes('operation:{action:"trash-board"'));
 assert.ok(s.includes('disabled={readOnly||busy||editor?.kind!=="board"}'));
});
test('trash view offers restore without permanent purge',()=>{
 const s=readFileSync(new URL('./app/board-trash.tsx',import.meta.url),'utf8');
 assert.ok(s.includes('action:"restore-board"'));assert.ok(s.includes('expiresAt'));
 assert.ok(!s.includes('action:"purge'));assert.ok(s.includes('role="alert"'));
});
