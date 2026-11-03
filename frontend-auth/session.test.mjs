import test from 'node:test';import assert from 'node:assert/strict';
import{bindTransport,apiFetch}from'./lib/api-client.ts';
globalThis.window=new EventTarget();
test('403 gate reset aborts concurrent requests and discards their responses',async()=>{
 let signal,release;
 const pending=new Promise(resolve=>release=resolve);
 const reset=()=>bindTransport(null);
 window.addEventListener('dotboard-auth-required',reset,{once:true});
 bindTransport({request:async(path,options)=>{
  if(path==='/workspace'){signal=options.signal;await pending;return new Response('{}');}
  return new Response('{}',{status:403});
 }});
 const stale=apiFetch('/api/workspace');
 try{
  await assert.rejects(apiFetch('/api/session'),/No tienes acceso/);
  assert.equal(signal.aborted,true);
  release();
  await assert.rejects(stale,/Session changed/);
 }finally{release();window.removeEventListener('dotboard-auth-required',reset);bindTransport(null);}
});
test('non-auth errors do not reset the gate or hide uncertain mutation outcomes',async()=>{
 let resets=0;const reset=()=>resets++;
 window.addEventListener('dotboard-auth-required',reset);
 try{for(const status of [400,409,413,415,500,503]){bindTransport({request:async()=>new Response('{}',{status})});assert.equal((await apiFetch('/api/workspace')).status,status);}assert.equal(resets,0);}
 finally{window.removeEventListener('dotboard-auth-required',reset);bindTransport(null);}
});
test('403 revocation requests auth gate reset and clears bound transport',async()=>{let fired=false;const reset=()=>{fired=true;bindTransport(null);};window.addEventListener('dotboard-auth-required',reset,{once:true});bindTransport({request:async()=>new Response('{}',{status:403})});try{await assert.rejects(apiFetch('/api/workspace'));assert.equal(fired,true);await assert.rejects(apiFetch('/api/workspace'),/Inicia sesión/);}finally{window.removeEventListener('dotboard-auth-required',reset);bindTransport(null);}});
test('unbound session fails without network',async()=>{bindTransport(null);await assert.rejects(apiFetch('/api/workspace'),/Inicia sesión/);});
test('session disposal aborts pending request and rejects stale response',async()=>{let signal,release;const pending=new Promise(r=>release=r);bindTransport({request:async(_path,options)=>{signal=options.signal;await pending;return new Response('{}');}});const result=apiFetch('/api/workspace');await new Promise(r=>setTimeout(r,0));bindTransport(null);assert.equal(signal.aborted,true);release();await assert.rejects(result,/Session changed/);});
test('401 requests auth gate reset',async()=>{let fired=false;window.addEventListener('dotboard-auth-required',()=>fired=true,{once:true});bindTransport({request:async()=>new Response('{}',{status:401})});await assert.rejects(apiFetch('/api/workspace'));assert.equal(fired,true);bindTransport(null);});
test('restore routes through bearer transport with preserved JSON and signal',async()=>{let seen;bindTransport({request:async(path,options)=>{seen={path,options};return new Response('{}');}});await apiFetch('/api/workspace/restore',{method:'POST',body:JSON.stringify({revision:4,requestId:'test',backup:{boards:[]}})});assert.equal(seen.path,'/workspace/restore');assert.equal(seen.options.body.revision,4);bindTransport(null);});
