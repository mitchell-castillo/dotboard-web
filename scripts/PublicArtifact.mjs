import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {validateConfig} from '../frontend-auth/transport.mjs';
const keys=['provider','tenantId','clientId','redirectUri','apiBaseUrl','apiScope'];
export function canonicalPublicConfig(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==keys.length||
     Object.keys(input).some(key=>!keys.includes(key))||keys.some(key=>typeof input[key]!=='string'))
    throw Error('Only the six public OAuth configuration fields are permitted.');
  return Object.fromEntries(keys.map(key=>[key,input[key]]));
}
export function configFingerprint(input){
  return createHash('sha256').update(JSON.stringify(canonicalPublicConfig(input))).digest('hex');
}
export function validatePublicConfig(input,policy,{checkFingerprint=true}={}){
  const config=canonicalPublicConfig(input);
  if(config.provider!=='entra')throw Error('Live configuration must use the reviewed identity provider.');
  let frontend,api,redirect;
  try{frontend=new URL(policy.target.frontendUrl);api=new URL(config.apiBaseUrl);redirect=new URL(config.redirectUri);}
  catch{throw Error('Invalid public URL configuration.');}
  if(frontend.protocol!=='https:'||frontend.username||frontend.password||frontend.search||frontend.hash||
     frontend.hostname==='mitchell-castillo.github.io')throw Error('An approved isolated HTTPS origin is required.');
  if(config.apiBaseUrl!==policy.target.backendUrl+'/api'||api.username||api.password||api.search||api.hash)
    throw Error('API target differs from the approved DotBoard host.');
  if(redirect.href!==frontend.href)throw Error('Redirect must match the reviewed statically served application URL.');
  try{validateConfig(config,frontend.origin);}catch{throw Error('Public OAuth metadata failed the application validation.');}
  if(checkFingerprint&&configFingerprint(config)!==policy.target.publicConfigSha256)
    throw Error('Public configuration differs from the reviewed fingerprint.');
  return config;
}
const secretPatterns=[
 /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s+[A-Za-z0-9+/=\s]{80,}/,
 /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
 /\bAccountKey=[A-Za-z0-9+/]{32,}={0,2}/,
 /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{12,}\b/,
 /["']?(?:boards|archivedCards)["']?\s*:\s*\[\s*\{/,
];
export function validateArtifactEntries(entries,policy,{requireConfigured=false}={}){
  if(!entries['index.html']||!entries['dotboard-config.json'])throw Error('Static application entry/config is missing.');
  for(const [name,content]of Object.entries(entries)){
    if(name.includes('\\')||name.includes('..')||
       !/^(?:index\.html|dotboard-config\.json|\.nojekyll|assets\/[A-Za-z0-9_.-]+\.(?:js|css))$/.test(name))
      throw Error('Unexpected file in the public artifact.');
    if(secretPatterns.some(pattern=>pattern.test(content)))throw Error('Potential secret or private data in public artifact.');
  }
  let input;try{input=JSON.parse(entries['dotboard-config.json']);}catch{throw Error('Invalid public configuration JSON.');}
  const config=canonicalPublicConfig(input);
  if(config.provider==='unconfigured'){
    if(requireConfigured||keys.some(key=>key!=='provider'&&config[key]!==''))throw Error('Unconfigured or partially filled deployment is blocked.');
  }else validatePublicConfig(config,policy);
  if(/\.map(?:["'\s]|$)/.test(entries['index.html']))throw Error('Source maps must not be published.');
}
export function readArtifact(root){
  const resolved=fs.realpathSync(root);
  if(fs.lstatSync(root).isSymbolicLink())throw Error('Linked artifact root is forbidden.');
  const entries={};
  for(const entry of fs.readdirSync(root,{recursive:true})){
    const file=path.join(root,entry),stat=fs.lstatSync(file);
    if(stat.isSymbolicLink()||(!stat.isDirectory()&&stat.nlink>1))throw Error('Artifact links are forbidden.');
    if(stat.isDirectory())continue;
    if(!fs.realpathSync(file).startsWith(resolved+path.sep))throw Error('Artifact escapes the build root.');
    entries[entry.split(path.sep).join('/')]=fs.readFileSync(file,'utf8');
  }
  return entries;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    const mode=process.argv[2],policy=JSON.parse(fs.readFileSync('.github/dotboard-release.json','utf8').replace(/^\uFEFF/,''));
    if(mode==='fingerprint'){
      const config=validatePublicConfig(JSON.parse(process.env.DOTBOARD_PUBLIC_CONFIG_JSON??''),policy,{checkFingerprint:false});
      console.log(configFingerprint(config));
    }else if(mode==='write-config'){
      const config=validatePublicConfig(JSON.parse(process.env.DOTBOARD_PUBLIC_CONFIG_JSON??''),policy);
      fs.writeFileSync('frontend-auth/public/dotboard-config.json',JSON.stringify(config)+'\n');
      console.log('PASS: only reviewed public OAuth metadata was written.');
    }else if(mode==='check-artifact'){
      validateArtifactEntries(readArtifact('frontend-auth/dist'),policy,{requireConfigured:process.argv.includes('--require-configured')});
      console.log('PASS: public artifact contains only static application files and public configuration.');
    }else throw Error('Unknown public artifact command.');
  }catch{
    console.error('Public artifact/configuration rejected. No configuration values were logged.');
    process.exitCode=1;
  }
}
