import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {verifyFullDeployment} from './VerifyFullSwaDeployment.mjs';
import {hosting} from './FullSwaArtifact.mjs';import {config} from './SwaArtifact.mjs';
const entries={'index.html':'<script src="/assets/bridge.js"></script>','app.html':'<script src="/assets/app.js"></script>','identity.html':'<script src="/assets/identity.js"></script>','assets/bridge.js':'bridge','assets/app.js':'app','assets/identity.js':'identity','dotboard-config.json':JSON.stringify(config),'staticwebapp.config.json':JSON.stringify(hosting)};
function mock(change=()=>{}){return async(url,options)=>{assert.equal(url.origin,new URL(config.redirectUri).origin);assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.ok(!url.pathname.startsWith('/api/'));const name=url.pathname==='/'?'index.html':url.pathname.slice(1);const v={body:entries[name],status:200,headers:{...hosting.globalHeaders}};change(v,name);return new Response(v.body,{status:v.status,headers:v.headers});};}
test('verifies full app plus root bridge identity and all assets without API',async()=>{assert.equal(await verifyFullDeployment(config.redirectUri,entries,mock()),true);});
test('wrong deployment target blocks before request',async()=>{let calls=0;await assert.rejects(verifyFullDeployment('https://example.com/',entries,async()=>{calls++;}));assert.equal(calls,0);});
for(const name of ['index.html','app.html','identity.html','assets/app.js','dotboard-config.json'])test(`changed ${name} rejects`,async()=>{await assert.rejects(verifyFullDeployment(config.redirectUri,entries,mock((v,n)=>{if(n===name)v.body+='changed';})));});
test('truncated body rejects',async()=>{await assert.rejects(verifyFullDeployment(config.redirectUri,entries,mock(v=>{v.body=v.body.slice(1);})));});
test('non-200 rejects',async()=>{await assert.rejects(verifyFullDeployment(config.redirectUri,entries,mock(v=>{v.status=404;})));});
for(const header of Object.keys(hosting.globalHeaders))test(`missing ${header} rejects`,async()=>{await assert.rejects(verifyFullDeployment(config.redirectUri,entries,mock(v=>{delete v.headers[header];})));});
test('root COOP rejects',async()=>{await assert.rejects(verifyFullDeployment(config.redirectUri,entries,mock((v,n)=>{if(n==='index.html')v.headers['Cross-Origin-Opener-Policy']='same-origin';})));});
test('missing app blocks before any request',async()=>{const e={...entries};delete e['app.html'];let calls=0;await assert.rejects(verifyFullDeployment(config.redirectUri,e,async()=>{calls++;}));assert.equal(calls,0);});
test('unexpected API file blocks before request',async()=>{await assert.rejects(verifyFullDeployment(config.redirectUri,{...entries,'api/workspace':'x'},mock()));});
test('workflow automatic main publish and concurrency stay guarded',()=>{const y=fs.readFileSync(new URL('../.github/workflows/frontend-full-swa.yml',import.meta.url),'utf8');assert.match(y,/group: dotboard-swa-production/);assert.match(y,/cancel-in-progress: false/);assert.match(y,/github.event_name == 'workflow_dispatch'/);assert.match(y,/github.ref == 'refs\/heads\/main'/);assert.match(y,/node scripts\/FullSwaArtifact.mjs full-check/);assert.match(y,/app_location: frontend-auth\/dist-full/);assert.match(y,/skip_api_build: true/);assert.match(y,/api_location: ''/);assert.doesNotMatch(y,/DOTBOARD_.*AUTODEPLOY.*true/);for(const x of y.matchAll(/uses: [^@\s]+@([^\s]+)/g))assert.match(x[1],/^[a-f0-9]{40}$/);});

test('only main push or explicit main dispatch can upload and publish',()=>{
 const y=fs.readFileSync(new URL('../.github/workflows/frontend-full-swa.yml',import.meta.url),'utf8');
 const upload=y.split('name: swa-full-')[0].split('if: ').at(-1).trim().replace(/\s+with:$/,'');
 const publish=y.split('  publish:')[1].split('    if: ')[1].split('\n')[0];
 const events="(github.event_name == 'push' || github.event_name == 'workflow_dispatch')";
 assert.equal(upload,events+" && github.ref == 'refs/heads/main'");
 assert.equal(publish,"github.repository == 'mitchell-castillo/dotboard-web' && github.repository_id == '1435130248' && github.ref_type == 'branch' && github.ref == 'refs/heads/main' && "+events);
 assert.match(y,/needs: validate/);assert.match(y,/permissions:\n  contents: read/);
 assert.match(y,/persist-credentials: false/);assert.match(y,/Recheck current main immediately before publication/);
 assert.match(y,/name: dotboard-swa-production/);assert.match(y,/node scripts\/VerifyFullSwaDeployment.mjs/);
});
