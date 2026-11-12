import fs from 'node:fs';
import {readArtifact,validateArtifactEntries,configFingerprint} from './PublicArtifact.mjs';
const origin='https://red-mushroom-06ff8430f.5.azurestaticapps.net';
export const config={provider:'entra',tenantId:'2ca6bfdc-8ef9-471e-9fa2-3798163649b1',clientId:'3f7d7d32-4723-458f-8a58-7e12cadbe0df',redirectUri:origin+'/',apiBaseUrl:'https://dotboardfunctions-atfgg7bxeeh3eqdp.eastus-01.azurewebsites.net/api',apiScope:'https://remindmeapp.onmicrosoft.com/8f4aea5c-0f25-465e-91ea-e035233859c6/DotBoard.Access'};
const policy={target:{frontendUrl:origin+'/',backendUrl:config.apiBaseUrl.slice(0,-4),publicConfigSha256:configFingerprint(config)}};
const headers={
 'Cache-Control':'no-store',
 'Referrer-Policy':'no-referrer',
 'X-Content-Type-Options':'nosniff',
 'X-Frame-Options':'DENY',
 'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self' https://login.microsoftonline.com; img-src 'self' data:; frame-src https://login.microsoftonline.com; base-uri 'none'; form-action https://login.microsoftonline.com; frame-ancestors 'none'; object-src 'none'"
};
export const hosting={globalHeaders:headers,routes:[{route:'/api/*',statusCode:404}]};
export function audit(entries){
 if(Object.hasOwn(entries,'assets/identity-entry-audit.js'))throw Error('Reserved audit filename');
 for(const n of ['identity.html','staticwebapp.config.json'])if(!entries[n])throw Error('Missing SWA entry');
 const extra=JSON.parse(entries['staticwebapp.config.json']);
 if(JSON.stringify(extra)!==JSON.stringify(hosting))throw Error('Unreviewed hosting configuration');
 const core={...entries};delete core['identity.html'];delete core['staticwebapp.config.json'];
 validateArtifactEntries({...core,'assets/identity-entry-audit.js':entries['identity.html']},policy,{requireConfigured:true});
 if(entries['identity.html'].includes('http')||!entries['identity.html'].includes('/assets/'))throw Error('Unexpected identity entry');
 for(const [name,content]of Object.entries(entries)){
  if(name.endsWith('.js')&&(/api\/workspace|initial-workspace|boards\s*:\s*\[\s*\{/.test(content)))throw Error('Workspace code in identity-only artifact');
 }
}
if(process.argv[2]==='prepare'){
 fs.renameSync('frontend-auth/dist/bridge.html','frontend-auth/dist/index.html');
 fs.writeFileSync('frontend-auth/dist/dotboard-config.json',JSON.stringify(config));
 fs.writeFileSync('frontend-auth/dist/staticwebapp.config.json',JSON.stringify(hosting));
}
if(['prepare','check'].includes(process.argv[2])){audit(readArtifact('frontend-auth/dist'));console.log('PASS: identity-only static artifact and exact isolated destination');}
