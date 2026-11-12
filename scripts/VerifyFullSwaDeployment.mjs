import {readArtifact} from './PublicArtifact.mjs';
import {auditFull,hosting} from './FullSwaArtifact.mjs';
import {config} from './SwaArtifact.mjs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

export async function verifyFullDeployment(deployedUrl,entries,fetcher=fetch){
 const target=new URL(config.redirectUri);
 if(typeof deployedUrl!=='string'||new URL(deployedUrl).href!==target.href)throw Error('Deployment output differs from approved destination');
 auditFull(entries);
 for(const [name,content] of Object.entries(entries)){
  if(name==='staticwebapp.config.json')continue;
  const url=new URL(name==='index.html'?'/':name,target);
  if(url.origin!==target.origin||url.search||url.hash||url.pathname.startsWith('/api/'))throw Error('Non-static verification target');
  const response=await fetcher(url,{redirect:'error',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
  if(response.status!==200||response.redirected||!response.body)throw Error('Published response rejected');
  const expected=Buffer.from(content,'utf8');
  const reader=response.body.getReader();let offset=0;
  try{
   while(true){const {done,value}=await reader.read();if(done)break;
    if(offset+value.byteLength>expected.length||!expected.subarray(offset,offset+value.byteLength).equals(Buffer.from(value)))throw Error('Published content mismatch');
    offset+=value.byteLength;
   }
   if(offset!==expected.length)throw Error('Published content truncated');
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  for(const [key,value] of Object.entries(hosting.globalHeaders)){
   const actual=response.headers.get(key);
   if(key==='Cache-Control'?!actual?.split(',').map(s=>s.trim().toLowerCase()).includes('no-store'):actual!==value)throw Error('Published security headers mismatch');
  }
  if(name==='index.html'&&response.headers.get('Cross-Origin-Opener-Policy'))throw Error('Bridge must not carry COOP');
 }
 return true;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const entries=readArtifact('frontend-auth/dist-full');let verified=false;
 for(let attempt=0;attempt<6;attempt++){
  try{await verifyFullDeployment(process.env.DEPLOYED_URL,entries);verified=true;break;}
  catch{if(attempt<5)await new Promise(resolve=>setTimeout(resolve,10000));}
 }
 if(!verified){console.error('Full UI deployment not verified: static bytes, origin or security headers differ. No API or data endpoint was called.');process.exitCode=1;}
 else console.log('Verified full UI app, root bridge, identity page and static assets. Human login and workspace access remain separate checks.');
}
