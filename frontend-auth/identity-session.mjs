export const sessionPolicy=Object.freeze({url:'https://dotboardfunctions-atfgg7bxeeh3eqdp.eastus-01.azurewebsites.net/api/session',workspaceId:'118e8351-646c-4777-8758-19b84b58cb86'});
// Caller MUST obtain `verified` from verifyAccessToken(token), not an ID token/cache.
export async function verifyHumanSession(token,verified,{signal,fetchImpl=globalThis.fetch}={}){
 if(!verified||typeof verified.oid!=='string'||typeof verified.sub!=='string'||!verified.sub||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(verified.oid)||typeof token!=='string'||!token||token.length>16384||signal?.aborted)throw Error('Session verification unavailable');
 const requestSignal=signal?AbortSignal.any([signal,AbortSignal.timeout(45000)]):AbortSignal.timeout(45000);
 const response=await fetchImpl(sessionPolicy.url,{method:'GET',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',signal:requestSignal});
 if(response.status!==200||response.redirected||response.headers.get('content-type')?.split(';')[0].trim()!=='application/json'||!response.body)throw Error('Session verification failed');
 const reader=response.body.getReader();let size=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192)throw Error('Session response rejected');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const body=JSON.parse(text);text='';
 if(!body||Array.isArray(body)||Object.keys(body).length!==4||body.authenticated!==true||body.actorKind!=='user'||body.workspaceId!==sessionPolicy.workspaceId||body.assistantIdentityConfigured!==true)throw Error('Session response rejected');
 return Object.freeze({authenticated:true,actorKind:'user',workspaceId:sessionPolicy.workspaceId,assistantIdentityConfigured:true});
}
