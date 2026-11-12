import {readArtifact} from './PublicArtifact.mjs';
import {audit,hosting,config} from './SwaArtifact.mjs';
import {pathToFileURL} from 'node:url';import path from 'node:path';
export async function verifyDeployment(deployedUrl,entries,fetcher=fetch){
 const target=new URL(config.redirectUri);
 if(typeof deployedUrl!=='string'||new URL(deployedUrl).href!==target.href)throw Error('Deployment output differs from approved destination');
 audit(entries);
 for(const [name,content]of Object.entries(entries)){
  if(name==='staticwebapp.config.json')continue; // Azure consumes this; it is not public content.
  const url=new URL(name==='index.html'?'/':name,target);
  const response=await fetcher(url,{redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(response.status!==200||await response.text()!==content)throw Error('Published content mismatch');
  for(const [key,value]of Object.entries(hosting.globalHeaders)){
   const actual=response.headers.get(key);
   if(key==='Cache-Control'?!actual?.split(',').map(s=>s.trim().toLowerCase()).includes('no-store'):actual!==value)throw Error('Published security headers mismatch');
  }
  if(name==='index.html'&&response.headers.get('Cross-Origin-Opener-Policy'))throw Error('Bridge must not carry COOP');
 }
 return true;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const entries=readArtifact('frontend-auth/dist');let verified=false;
 for(let attempt=0;attempt<6;attempt++){
  try{await verifyDeployment(process.env.DEPLOYED_URL,entries);verified=true;break;}
  catch{if(attempt<5)await new Promise(resolve=>setTimeout(resolve,10000));}
 }
 if(!verified){console.error('Deployment not verified: approved origin, exact static content or required headers did not match. No API or data endpoint was called.');process.exitCode=1;}
 else console.log('Verified approved SWA origin, exact static files and security headers. Human sign-in remains a separate validation.');
}
