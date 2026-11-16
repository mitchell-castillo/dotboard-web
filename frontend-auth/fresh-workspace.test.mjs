import test from 'node:test';
import assert from 'node:assert/strict';
import {readFreshWorkspace} from './fresh-workspace.mjs';
test('each read makes a new authenticated GET and returns full response', async()=>{
 let calls=0;
 const api=async(path,options)=>{assert.equal(path,'/api/workspace');assert.deepEqual(options,{method:'GET',cache:'no-store'});return {ok:true,json:async()=>({workspace:{revision:++calls,boards:[],archivedCards:[{id:'synthetic'}]}})};};
 assert.equal((await readFreshWorkspace(api)).revision,1);
 const next=await readFreshWorkspace(api);assert.equal(next.revision,2);assert.equal(next.archivedCards.length,1);assert.equal(calls,2);
});
test('auth, network, HTTP and malformed responses fail rather than return cache', async()=>{
 for(const api of [async()=>{throw Error('interaction_required');},async()=>{throw Error('network');},async()=>({ok:false,status:401}),async()=>({ok:false,status:500}),async()=>({ok:true,json:async()=>({workspace:{revision:1}})})]){
  await assert.rejects(readFreshWorkspace(api));
 }
});
