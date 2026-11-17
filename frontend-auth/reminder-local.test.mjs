import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actionSchema} from './lib/workspace-store.ts';
import {PendingWrite} from './lib/pending-write.ts';
const operation={action:'update-reminder-local',seriesId:'synthetic',expectedLocalRevision:0,title:'Synthetic local title',notes:'A single adjustment.\nRemove after confirmation.'};
test('local reminder contract accepts multiline notes, empty overrides and boundary lengths',()=>{
 for(const value of [operation,{...operation,title:'',notes:''},{...operation,title:'t'.repeat(200),notes:'n'.repeat(5000)}])assert.ok(actionSchema.safeParse(value).success);
});
test('local reminder contract rejects unexpected fields, invalid values and missing CAS',()=>{
 for(const value of [{...operation,title:'t'.repeat(201)},{...operation,notes:'n'.repeat(5001)},{...operation,title:' bad'},{...operation,title:'bad\nline'},{...operation,notes:'bad\0note'},{...operation,notes:'bad\u0085note'},{...operation,expectedLocalRevision:-1},{...operation,expectedLocalRevision:2147483647},{...operation,expectedLocalRevision:undefined},{...operation,notes:null},{...operation,sourceRecord:{}},{...operation,Frequency:'EVERY_MONTH'},{...operation,dueAt:1},{...operation,notificationsEnabled:true}])assert.equal(actionSchema.safeParse(value).success,false);
});
test('uncertain local edit preserves exact text and revisions for receipt recovery',()=>{
 const pending=new PendingWrite(),draft={...operation};
 const original=pending.begin({revision:8,requestId:'synthetic-request',operation:draft});
 draft.notes='Later unsent text';draft.title='Later title';
 assert.equal(pending.replay(),original);assert.equal(JSON.parse(pending.replay()).operation.notes,operation.notes);
 assert.throws(()=>pending.begin({revision:9,operation:draft}));
 assert.equal(pending.rejectDefinitively(503,'storage_retry_later'),false);
 assert.equal(pending.replay(),original);
 pending.acknowledgeSuccess();assert.equal(pending.hasPending(),false);
});
