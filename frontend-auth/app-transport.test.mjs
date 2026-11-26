import test from 'node:test';import assert from 'node:assert/strict';import {PopupSessionTransport} from './app-transport.mjs';
function setup(){let active=null;const calls=[];const account={homeAccountId:'human'};const msal={initialize:async()=>{},getActiveAccount:()=>active,setActiveAccount:a=>active=a,clearCache:async()=>{},acquireTokenPopup:async()=>({account,accessToken:'test'}),acquireTokenSilent:async()=>({account,accessToken:'test'}),logoutPopup:async()=>{}};
const t=new PopupSessionTransport({apiScope:'scope',apiBaseUrl:'https://example.test/api',redirectUri:'https://example.test/'},msal,async(u,o)=>{calls.push([u,o]);return new Response('{}');},async()=>({verified:true}),async()=>({authenticated:true}));return {t,msal,calls,account};}
test('no workspace request before verified session',async()=>{const {t,calls}=setup();await t.initialize();await assert.rejects(t.request('/workspace'));assert.equal(calls.length,0);});
test('session is awaited before membership and workspace',async()=>{const {t,calls}=setup();let release;t.session=()=>new Promise(r=>release=r);const login=t.login();await new Promise(r=>setTimeout(r,0));await assert.rejects(t.request('/workspace'));release({});await login;await t.request('/workspace');assert.equal(calls.length,1);assert.equal(calls[0][1].redirect,'error');assert.equal(calls[0][1].credentials,'omit');});
test('cancel popup leaves signed out and permits retry',async()=>{const {t,msal}=setup();const popup=msal.acquireTokenPopup;msal.acquireTokenPopup=async()=>{throw Error('private');};await assert.rejects(t.login(),/Session verification failed/);assert.equal(t.interacting,false);msal.acquireTokenPopup=popup;await t.login();assert.equal(t.authorized,'human');});
test('duplicate clicks are blocked and navigation invalidates pending session',async()=>{const {t}=setup();let release;t.session=()=>new Promise(r=>release=r);const login=t.login();await new Promise(r=>setTimeout(r,0));await assert.rejects(t.login(),/progress/);t.invalidate();release({});await assert.rejects(login);assert.equal(t.authorized,null);});
test('failed verification never opens workspace',async()=>{const {t,calls}=setup();t.verify=async()=>{throw Error('bad');};await assert.rejects(t.login());await assert.rejects(t.request('/workspace'));assert.equal(calls.length,0);});
test('logout clears membership even if provider popup fails',async()=>{const {t,msal}=setup();await t.login();msal.logoutPopup=async()=>{throw Error('cancel');};await assert.rejects(t.logout());assert.equal(t.authorized,null);await assert.rejects(t.request('/workspace'));});
test('account switch rejects before request',async()=>{const {t,msal}=setup();await t.login();msal.setActiveAccount({homeAccountId:'other'});await assert.rejects(t.request('/workspace'));});
test('logout during silent acquisition prevents outgoing request',async()=>{const {t,msal,calls,account}=setup();await t.login();let release;msal.acquireTokenSilent=()=>new Promise(r=>release=r);const request=t.request('/workspace');t.invalidate();release({accessToken:'test',account});await assert.rejects(request);assert.equal(calls.length,0);});

test('logout locks concurrent logout and login until completed',async()=>{const {t,msal}=setup();await t.login();let release;msal.logoutPopup=()=>new Promise(r=>release=r);const logout=t.logout();await assert.rejects(t.logout(),/progress/);await assert.rejects(t.login(),/progress/);await new Promise(r=>setTimeout(r,0));release();await logout;assert.equal(t.interacting,false);});

test('verified session permits editing and import but never delete or restore',async()=>{const {t,calls}=setup();await t.login();await t.request('/workspace',{method:'POST',body:{operation:{action:'create-card'}}});await t.request('/workspace/current-import',{method:'POST',body:{requestId:'test',backup:{}}});assert.equal(calls.length,2);assert.equal((await t.request('/workspace/restore',{method:'POST'})).status,400);assert.equal((await t.request('/workspace',{method:'POST',body:{operation:{action:'delete-card'}}})).status,400);assert.equal(calls.length,2);});
test('signed out cannot import or edit',async()=>{const {t,calls}=setup();await assert.rejects(t.request('/workspace/current-import',{method:'POST'}));await assert.rejects(t.request('/workspace',{method:'POST',body:{operation:{action:'create-card'}}}));assert.equal(calls.length,0);});

test('popup default fetch remains globally bound through delegated request',async()=>{
 const original=globalThis.fetch;let receiver;
 try{globalThis.fetch=function(){receiver=this;return Promise.resolve(new Response('{}'));};
 const {msal}=setup();
 const t=new PopupSessionTransport({apiScope:'scope',apiBaseUrl:'https://example.test/api',redirectUri:'https://example.test/'},msal,undefined,async()=>({verified:true}),async()=>({authenticated:true}));
 await t.login();await t.request('/workspace');assert.equal(receiver,globalThis);
 }finally{globalThis.fetch=original;}
});

test('initial account setup needs explicit flag, verified owner and exact canonical API',async()=>{
 const {msal}=setup();const calls=[];const good='https://dotboardfunctions-atfgg7bxeeh3eqdp.eastus-01.azurewebsites.net/api';
 const cfg={apiScope:'scope',apiBaseUrl:good,redirectUri:'https://example.test/',ownerInitialSetup:true};
 let status=201;const t=new PopupSessionTransport(cfg,msal,async(url,init)=>{calls.push({url,init});return new Response(null,{status});},async()=>({verified:true}),async()=>({authenticated:true}));
 const user='synthetic-owner',password='long synthetic password';
 await assert.rejects(t.provisionOwner(user,password));await t.login();
 t.config={...cfg,ownerInitialSetup:false};await assert.rejects(t.provisionOwner(user,password));
 t.config={...cfg,apiBaseUrl:'https://example.test/api'};await assert.rejects(t.provisionOwner(user,password));
 t.config=cfg;await assert.rejects(t.provisionOwner(user,'short'));assert.equal(calls.length,0);
 assert.equal(await t.provisionOwner(user,password),'created');assert.equal(calls.length,1);
 assert.equal(calls[0].url,good+'/auth/owner/initial-setup');assert.equal(calls[0].init.credentials,'omit');assert.equal(calls[0].init.redirect,'error');
 assert.deepEqual(JSON.parse(calls[0].init.body),{username:user,password});assert.equal(calls[0].init.headers.Authorization,'Bearer test');
 status=409;assert.equal(await t.provisionOwner(user,password),'exists');assert.equal(calls.length,2);
});
