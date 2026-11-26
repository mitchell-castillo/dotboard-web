import test from 'node:test';
import assert from 'node:assert/strict';
import {InternalSessionTransport} from './internal-session-transport.mjs';
const token='A'.repeat(43), csrf='B'.repeat(43);
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
test('login credentials only on login; session token and CSRF scoped to allowed endpoint',async()=>{
 const calls=[];const transport=new InternalSessionTransport(async(url,init)=>{calls.push({url,init});return url.endsWith('/auth/login')?response({authenticated:true,actorKind:'user',sessionToken:token,csrfToken:csrf}):url.endsWith('/auth/logout')?new Response(null,{status:204}):response({workspace:{}});});
 assert.equal(await transport.initialize(),null);await transport.login('fixture','fixture password');assert.equal(transport.authorized,true);
 await transport.request('/workspace');await transport.request('/workspace',{method:'POST',body:{revision:1,requestId:'fixture',operation:{action:'create-card'}}});
 assert.equal(calls[0].init.headers['X-DotBoard-Session'],undefined);assert.equal(calls[1].init.headers['X-DotBoard-Session'],token);assert.equal(calls[1].init.headers['X-CSRF-Token'],undefined);assert.equal(calls[2].init.headers['X-CSRF-Token'],csrf);assert.equal(calls[1].url.endsWith('/api/local/workspace'),true);
 assert.ok(calls.every(c=>c.init.credentials==='omit'&&c.init.redirect==='error'&&c.init.cache==='no-store'));
 await assert.rejects(transport.request('https://example.com'));await assert.rejects(transport.request('/workspace/restore'));assert.equal(calls.length,3);
 await transport.logout();assert.equal(transport.authorized,false);await assert.rejects(transport.request('/workspace'));
});
test('failed login never grants access, reload loses session',async()=>{
 const t=new InternalSessionTransport(async()=>response({authenticated:true,actorKind:'dot',sessionToken:token,csrfToken:csrf}));await assert.rejects(t.login('fixture','password'));assert.equal(t.authorized,false);
 const fresh=new InternalSessionTransport(async()=>response({authenticated:true,actorKind:'user',sessionToken:token,csrfToken:csrf}));await fresh.login('fixture','password');await fresh.initialize();assert.equal(fresh.authorized,false);
});
test('401 invalidates and in-flight response cannot survive logout',async()=>{
 let release;const t=new InternalSessionTransport(async(url)=>url.endsWith('/auth/login')?response({authenticated:true,actorKind:'user',sessionToken:token,csrfToken:csrf}):url.endsWith('/auth/logout')?new Response(null,{status:204}):new Promise(resolve=>release=resolve));await t.login('fixture','password');const pending=t.request('/workspace');await t.logout();release(response({workspace:{}}));await assert.rejects(pending);
});

test('supported auxiliary routes preserve current-only policy and session protections',async()=>{
 const calls=[];const t=new InternalSessionTransport(async(url,init)=>{calls.push({url,init});return url.endsWith('/auth/login')?response({authenticated:true,actorKind:'user',sessionToken:token,csrfToken:csrf}):response({});});
 await t.login('fixture','fixture password');
 await t.request('/workspace/backup');
 await t.request('/workspace/instructions?boardId=fixture&format=md');
 await t.request('/workspace/current-import',{method:'POST',body:{fixture:true}});
 assert.ok(calls[1].url.endsWith('/api/local/workspace/backup'));
 assert.ok(calls[2].url.endsWith('/api/local/workspace/instructions?boardId=fixture&format=md'));
 assert.ok(calls[3].url.endsWith('/api/local/workspace/current-import'));
 assert.equal(calls[1].init.headers['X-CSRF-Token'],undefined);
 assert.equal(calls[3].init.headers['X-CSRF-Token'],csrf);
 for(const path of ['/workspace/instructions/history?boardId=fixture','/workspace/instructions?boardId=fixture&boardId=other','/workspace/instructions?boardId=fixture&extra=value','/workspace/restore'])await assert.rejects(t.request(path));
 assert.equal(calls.length,4);
});
