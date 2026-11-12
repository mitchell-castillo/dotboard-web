import { createRemoteJWKSet, jwtVerify, base64url } from 'jose';
export const policy = Object.freeze({
 origin:'https://red-mushroom-06ff8430f.5.azurestaticapps.net',
 tenant:'2ca6bfdc-8ef9-471e-9fa2-3798163649b1',
 client:'3f7d7d32-4723-458f-8a58-7e12cadbe0df',
 issuer:'https://sts.windows.net/2ca6bfdc-8ef9-471e-9fa2-3798163649b1/',
 audience:'https://remindmeapp.onmicrosoft.com/8f4aea5c-0f25-465e-91ea-e035233859c6',
 scope:'https://remindmeapp.onmicrosoft.com/8f4aea5c-0f25-465e-91ea-e035233859c6/DotBoard.Access'
});
export function assertOrigin(origin) { if(origin!==policy.origin) throw Error('Unapproved origin'); }
// Fixed Microsoft discovery/JWKS endpoint, never taken from a token header.
const keys=createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${policy.tenant}/discovery/keys`));
export async function verifyAccessToken(token, keyResolver=keys) {
 if(typeof token!=='string'||token.length>16384||/\s/.test(token))throw Error('Invalid token shape');
 const {payload:p,protectedHeader:h}=await jwtVerify(token,keyResolver,{algorithms:['RS256'],issuer:policy.issuer,audience:policy.audience,
   requiredClaims:['exp','nbf','iat','sub','tid','oid','appid','scp','ver'],clockTolerance:0});
 const canonicalId=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)&&v!=='00000000-0000-0000-0000-000000000000';
 if(!['JWT','at+jwt'].includes(h.typ)||p.ver!=='1.0'||p.aud!==policy.audience||p.tid!==policy.tenant||p.appid!==policy.client
   ||!['tid','appid','oid'].every(k=>canonicalId(p[k]))
   ||(Object.hasOwn(p,'idtyp')&&p.idtyp!=='user')||Object.hasOwn(p,'roles')
   ||['idtyp','tid','oid','appid','azp','appidacr','azpacr'].some(k=>Object.hasOwn(p,k)&&(typeof p[k]!=='string'||!p[k].trim()))
   ||!['iat','nbf','exp'].every(k=>Number.isSafeInteger(p[k])&&p[k]>=0)||p.nbf>p.exp||p.iat>p.exp||p.iat>Math.floor(Date.now()/1000)
   ||typeof p.scp!=='string'||!p.scp.split(' ').includes('DotBoard.Access')||p.scp.split(' ').some(s=>!s||/[^!-~]/.test(s))
   ||new Set(p.scp.split(' ')).size!==p.scp.split(' ').length
   ||typeof p.sub!=='string'||!/^[A-Za-z0-9_.~-]{1,256}$/.test(p.sub)) throw Error('Identity rejected');
 for(const segment of token.split('.').slice(0,2)) assertUniqueRootKeys(new TextDecoder('utf-8',{fatal:true}).decode(base64url.decode(segment))); // Allowlist only. Never return token, email, name, ID-token claims or arbitrary claims.
 return Object.freeze({sub:p.sub,tid:p.tid,oid:p.oid,iss:p.iss,aud:p.aud,appid:p.appid,scp:p.scp,exp:p.exp});
}
// Called only after JOSE signature verification and valid JSON parsing. Detect root
// duplicates lost by JSON.parse, including escaped property names; limit nesting.
function assertUniqueRootKeys(json){
 const seen=new Set();let depth=0;
 for(let i=0;i<json.length;i++){
  const c=json[i];
  if(c==='"'){
   const start=i;for(i++;i<json.length;i++){if(json[i]==='\\')i++;else if(json[i]==='"')break;}
   let next=i+1;while(/\s/.test(json[next]??'')&&next<json.length)next++;
   if(depth===1&&json[next]===':'){const key=JSON.parse(json.slice(start,i+1));if(seen.has(key))throw Error('Duplicate claim');seen.add(key);}
  }else if(c==='{'||c==='['){if(++depth>16)throw Error('Excessive nesting');}
  else if(c==='}'||c===']')depth--;
 }
}
