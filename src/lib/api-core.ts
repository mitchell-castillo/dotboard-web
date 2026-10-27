/** Public browser transport only. Never accepts API keys or identity headers. */
export type Session = {actor:{id:string;displayName:string};workspaceId:string;csrfToken:string};
export type ApiOptions = {baseUrl:string;allowLocalHttp?:boolean;fetchImpl?:typeof fetch;onAccessLost?:()=>void};
export function validateBaseUrl(value:string,allowLocalHttp=false):string {
  if(!value)throw new Error("El backend seguro todavía no está configurado.");
  const u=new URL(value);
  const local=allowLocalHttp&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);
  if((u.protocol!=='https:'&&!(local&&u.protocol==='http:'))||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw new Error('La URL de API debe ser un origen HTTPS sin credenciales ni ruta.');
  return u.origin;
}
export function createApiClient(options:ApiOptions){
  const base=validateBaseUrl(options.baseUrl,options.allowLocalHttp);
  const transport=options.fetchImpl??globalThis.fetch;
  let session:Session|null=null;
  function clear(){session=null;options.onAccessLost?.();}
  function url(path:string){
    if(!path.startsWith('/')||path.startsWith('//')||path.includes('\\')||/[\r\n]/.test(path))throw new Error('Ruta de API no permitida.');
    const u=new URL(path,base);
    const allowed=['/api/session','/api/workspace','/api/workspace/backup','/api/workspace/restore','/api/workspace/instructions','/api/workspace/instructions/history','/auth/logout'];
    if(u.origin!==base||!allowed.includes(u.pathname)||u.hash)throw new Error('Ruta de API no permitida.');
    return u.href;
  }
  async function request(path:string,init:RequestInit={}){
    const target=url(path); const method=(init.method??'GET').toUpperCase();
    if(!['GET','POST'].includes(method))throw new Error('Método no permitido.');
    const headers=new Headers(init.headers);
    for(const key of headers.keys())if(/^(authorization|cookie|oai-|x-user|x-actor|x-workspace|x-csrf-token)/i.test(key))throw new Error('Cabecera de identidad o seguridad no permitida.');
    headers.delete('X-Dot-Board-Local');
    if(method==='POST'){
      if(!session?.csrfToken)throw new Error('Inicia sesión antes de guardar.');
      headers.set('X-CSRF-Token',session.csrfToken);
    } else if(path!=='/api/session'&&!session)throw new Error('Inicia sesión antes de acceder al espacio.');
    const response=await transport(target,{...init,method,headers,credentials:'include',cache:'no-store',redirect:'error'});
    if(response.status===401||response.status===403)clear();
    return response;
  }
  async function getSession(signal?:AbortSignal):Promise<Session|null>{
    session=null;
    const r=await request('/api/session',{signal});
    if(r.status===401||r.status===403)return null;
    if(!r.ok)throw new Error('No se pudo verificar la sesión.');
    const data=await r.json();
    if(data?.authenticated!==true||typeof data.actor?.id!=='string'||!data.actor.id||typeof data.actor?.displayName!=='string'||typeof data.workspaceId!=='string'||!data.workspaceId||typeof data.csrfToken!=='string'||!data.csrfToken)throw new Error('La API no confirmó una sesión válida.');
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    session={actor:{id:data.actor.id,displayName:data.actor.displayName},workspaceId:data.workspaceId,csrfToken:data.csrfToken};
    return session;
  }
  function loginUrl(returnTo:string){
    const destination=new URL(returnTo);
    if(destination.protocol!=='https:'&&!(options.allowLocalHttp&&['localhost','127.0.0.1','[::1]'].includes(destination.hostname)&&destination.protocol==='http:'))throw new Error('Destino de acceso no permitido.');
    const target=new URL('/auth/login',base);target.searchParams.set('return_to',destination.origin+destination.pathname);return target.href;
  }
  async function logout(){
    try{const r=await request('/auth/logout',{method:'POST'});if(!r.ok)throw new Error('No se pudo confirmar el cierre de sesión en el servidor.');}
    finally{clear();}
  }
  return {request,getSession,loginUrl,logout,clear};
}
