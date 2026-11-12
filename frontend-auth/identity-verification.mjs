import { createRemoteJWKSet, jwtVerify } from 'jose';
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
 const {payload:p}=await jwtVerify(token,keyResolver,{algorithms:['RS256'],issuer:policy.issuer,audience:policy.audience,
   requiredClaims:['exp','nbf','iat','sub','tid','oid','appid','scp','ver'],clockTolerance:0});
 if(p.ver!=='1.0'||p.tid!==policy.tenant||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.oid??''))||p.appid!==policy.client||p.idtyp==='app'
   ||typeof p.scp!=='string'||!p.scp.split(' ').includes('DotBoard.Access')
   ||typeof p.sub!=='string'||!/^[A-Za-z0-9_.~-]{1,256}$/.test(p.sub)) throw Error('Identity rejected');
 // Allowlist only. Never return token, email, name, ID-token claims or arbitrary claims.
 return Object.freeze({sub:p.sub,tid:p.tid,oid:p.oid,iss:p.iss,aud:p.aud,appid:p.appid,scp:p.scp,exp:p.exp});
}
