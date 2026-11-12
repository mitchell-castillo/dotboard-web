import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
let moduleId=0;
async function setup(){
 const elements=Object.fromEntries(['login','clear','result','status'].map(k=>[k,{disabled:false,textContent:'',listeners:{},addEventListener(n,f){this.listeners[n]=f;}}]));
 const events={};let resolve,reject,calls=0,clears=0;
 class Client{async initialize(){} acquireTokenPopup(){calls++;return new Promise((yes,no)=>{resolve=yes;reject=no;});}async clearCache(){clears++;}}
 globalThis.__identityHarness={Client};globalThis.document={querySelector:s=>elements[s.slice(1)]};globalThis.location={origin:'synthetic'};
 globalThis.window={addEventListener:(n,f)=>{events[n]=f;}};window.self=window;window.top=window;
 let source=fs.readFileSync(new URL('./identity.mjs',import.meta.url),'utf8').replace(/import[^;]+;/g,'');
 source='const PublicClientApplication=globalThis.__identityHarness.Client;const BrowserCacheLocation={MemoryStorage:"memoryStorage"};const policy={};const assertOrigin=()=>{};const verifyAccessToken=async()=>({sub:"synthetic-verified-sub"});'+source;
 await import('data:text/javascript,'+encodeURIComponent(source+`\n//${moduleId++}`));await Promise.resolve();
 return {elements,events,resolve:()=>resolve({accessToken:'synthetic-only'}),reject:()=>reject(Error('synthetic failure')),calls:()=>calls,clears:()=>clears};
}
test('UI double click blocked, verified claims only, hide clears',async()=>{const h=await setup();const first=h.elements.login.listeners.click();await h.elements.login.listeners.click();assert.equal(h.calls(),1);h.resolve();await first;assert.equal(h.elements.result.textContent,'{\n  "sub": "synthetic-verified-sub"\n}');h.elements.clear.listeners.click();assert.equal(h.elements.result.textContent,'');assert.ok(h.clears()>=2);});
test('UI cancelled popup permits retry',async()=>{const h=await setup();const first=h.elements.login.listeners.click();h.reject();await first;assert.equal(h.elements.result.textContent,'');assert.equal(h.elements.login.disabled,false);const second=h.elements.login.listeners.click();assert.equal(h.calls(),2);h.resolve();await second;});
test('UI navigation discards pending result',async()=>{const h=await setup();const first=h.elements.login.listeners.click();h.events.pagehide();h.resolve();await first;assert.equal(h.elements.result.textContent,'');});
