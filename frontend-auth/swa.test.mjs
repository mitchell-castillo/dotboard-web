import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {audit,hosting,config} from '../scripts/SwaArtifact.mjs';
import {policy} from './identity-verification.mjs';
const entries={'index.html':'<script src="/assets/bridge.js"></script>','identity.html':'<script src="/assets/identity.js"></script>','dotboard-config.json':JSON.stringify(config),'staticwebapp.config.json':JSON.stringify(hosting),'assets/bridge.js':'void 0','assets/identity.js':'void 0'};
test('isolated release metadata agrees with verifier',()=>{assert.equal(config.redirectUri,policy.origin+'/');assert.equal(config.clientId,policy.client);assert.equal(config.tenantId,policy.tenant);assert.equal(config.apiScope,policy.scope);audit(entries);});
for(const name of ['backend.dll','.git/config','initial-workspace.json','assets/source.map','test.html'])test(`artifact rejects ${name}`,()=>assert.throws(()=>audit({...entries,[name]:'x'})));
test('artifact rejects unreviewed CSP',()=>assert.throws(()=>audit({...entries,'staticwebapp.config.json':'{}'})));
test('artifact rejects shared origin',()=>assert.throws(()=>audit({...entries,'dotboard-config.json':JSON.stringify({...config,redirectUri:'https://mitchell-castillo.github.io/dotboard-web/'})})));
test('identity source isolates explicit session without workspace',()=>{const s=fs.readFileSync(new URL('./identity.mjs',import.meta.url),'utf8');assert.doesNotMatch(s,/fetch\(|BoardApp|transport|api-client|localStorage|sessionStorage|console\./);assert.match(s,/MemoryStorage/);});
test('workflow manual, main only, dist only, no PR preview permissions',()=>{const s=fs.readFileSync(new URL('../.github/workflows/frontend-swa.yml',import.meta.url),'utf8');assert.match(s,/workflow_dispatch:/);assert.match(s,/pull_request:/);assert.match(s,/needs: validate/);assert.match(s,/github.event_name == 'workflow_dispatch'/);assert.equal(s.split('secrets.').length-1,1);assert.ok(!s.split('  publish:')[0].includes('environment:'));assert.doesNotMatch(s,/id-token:|pages:|repo_token:|write/);assert.match(s,/app_location: frontend-auth\/dist/);assert.match(s,/skip_api_build: true/);assert.match(s,/dotboard-swa-production/);});
test('artifact scans identity HTML for secrets and workspace payloads',()=>{for(const payload of ['<!-- ghp_'+'x'.repeat(30)+' -->','<script type="application/json">{"boards":[{"synthetic":true}]}</script>'])assert.throws(()=>audit({...entries,'identity.html':entries['identity.html']+payload}));});
test('reserved audit filename cannot mask a secret',()=>assert.throws(()=>audit({...entries,'assets/identity-entry-audit.js':'ghp_'+'x'.repeat(30)})));

import {verifyDeployment} from '../scripts/VerifySwaDeployment.mjs';
const fakeFetch=(changes={})=>async url=>{const name=url.pathname==='/'?'index.html':url.pathname.slice(1);return new Response(entries[name],{status:200,headers:{...hosting.globalHeaders,...changes}});};
test('deployment verifies exact static bytes and all security headers, no API calls',async()=>assert.equal(await verifyDeployment(config.redirectUri,entries,fakeFetch()),true));
test('deployment rejects wrong action destination before network',async()=>{let calls=0;await assert.rejects(()=>verifyDeployment('https://evil.invalid/',entries,()=>{calls++;}));assert.equal(calls,0);});
test('deployment rejects altered content',async()=>assert.rejects(()=>verifyDeployment(config.redirectUri,entries,async()=>new Response('wrong',{headers:hosting.globalHeaders}))));
test('deployment rejects missing security header',async()=>assert.rejects(()=>verifyDeployment(config.redirectUri,entries,fakeFetch({'Referrer-Policy':'unsafe-url'}))));
test('deployment rejects COOP on bridge',async()=>assert.rejects(()=>verifyDeployment(config.redirectUri,entries,fakeFetch({'Cross-Origin-Opener-Policy':'same-origin'}))));

test('CSP allows only the exact session route on backend',()=>{const csp=hosting.globalHeaders['Content-Security-Policy'];assert.match(csp,/https:\/\/dotboardfunctions-atfgg7bxeeh3eqdp\.eastus-01\.azurewebsites\.net\/api\/session;/);assert.doesNotMatch(csp,/azurewebsites\.net[ ;]/);});