import fs from 'node:fs';
import {config,hosting as diagnosticHosting} from './SwaArtifact.mjs';
import {readArtifact,validateArtifactEntries,configFingerprint} from './PublicArtifact.mjs';
export const hosting={...diagnosticHosting,globalHeaders:{...diagnosticHosting.globalHeaders,'Content-Security-Policy':diagnosticHosting.globalHeaders['Content-Security-Policy'].replace('/api/session;','/api/;').replace("style-src 'self';","style-src 'self'; style-src-attr 'unsafe-inline';")}};
const policy={target:{frontendUrl:config.redirectUri,backendUrl:config.apiBaseUrl.slice(0,-4),publicConfigSha256:configFingerprint(config)}};
export function auditFull(entries){
 for(const n of ['assets/app-html-audit.js','assets/identity-html-audit.js'])if(Object.hasOwn(entries,n))throw Error('Reserved audit filename');
 for(const n of ['app.html','identity.html','index.html','staticwebapp.config.json'])if(!entries[n])throw Error('Missing entry');
 if(JSON.stringify(JSON.parse(entries['staticwebapp.config.json']))!==JSON.stringify(hosting))throw Error('Hosting differs');
 const core={...entries};delete core['staticwebapp.config.json'];
 for(const n of ['app','identity']){core['assets/'+n+'-html-audit.js']=core[n+'.html'];delete core[n+'.html'];}
 validateArtifactEntries(core,policy,{requireConfigured:true});
 for(const n of ['app.html','identity.html'])if(entries[n].includes('http')||!entries[n].includes('/assets/'))throw Error('External entry');
}
if(process.argv[2]==='full-prepare'){
 fs.renameSync('frontend-auth/dist-full/bridge.html','frontend-auth/dist-full/index.html');
 fs.writeFileSync('frontend-auth/dist-full/dotboard-config.json',JSON.stringify(config));
 fs.writeFileSync('frontend-auth/dist-full/staticwebapp.config.json',JSON.stringify(hosting));
}
if(['full-prepare','full-check'].includes(process.argv[2])){auditFull(readArtifact('frontend-auth/dist-full'));console.log('PASS: isolated full UI static artifact');}
