import test from 'node:test';
import assert from 'node:assert/strict';
import {actionSchema} from './lib/workspace-store.ts';
import {readFileSync} from 'node:fs';
test('pause and resume require an explicit expected state',()=>{
 for(const paused of [false,true]){
  assert.equal(actionSchema.safeParse({action:'set-board-paused',boardId:'b',paused,expected:!paused}).success,true);
  assert.equal(actionSchema.safeParse({action:'set-board-paused',boardId:'b',paused}).success,false);
 }
});
test('pause rejects strings and unrelated fields',()=>{
 assert.equal(actionSchema.safeParse({action:'set-board-paused',boardId:'b',paused:'true',expected:false}).success,false);
 assert.equal(actionSchema.safeParse({action:'set-board-paused',boardId:'b',paused:true,expected:false,columns:[]}).success,false);
});
test('board UI exposes pause and resume in separate groups without delete',()=>{
 const source=readFileSync(new URL('./app/board-app.tsx',import.meta.url),'utf8');
 assert.ok(source.includes('Tableros pausados'));
 assert.ok(source.includes('Reanudar tablero'));
 assert.ok(source.includes('Pausar tablero'));
 assert.ok(source.includes('Las tareas externas ya iniciadas no se cancelan'));
 assert.ok(source.includes('disabled={readOnly||busy||loading||recoveryAvailable}'));
 assert.ok(source.includes('expected:target.paused===true'));
});
