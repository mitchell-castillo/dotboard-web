import type {DotBoardTransport} from '../transport.mjs';
let current:DotBoardTransport|null=null;let generation=0;const active=new Set<AbortController>();
export function bindTransport(transport:DotBoardTransport|null){generation++;for(const c of active)c.abort();active.clear();current=transport;}
export async function apiFetch(path:string,init:RequestInit={}) {
 const transport=current,version=generation;if(!transport)throw new Error('Inicia sesión para acceder a DotBoard.');
 const controller=new AbortController();active.add(controller);const abort=()=>controller.abort();init.signal?.addEventListener('abort',abort,{once:true});
 try{
  if(init.signal?.aborted)controller.abort();
  const response=await transport.request(path.replace(/^\/api/,''),{method:init.method??'GET',body:typeof init.body==='string'?JSON.parse(init.body):undefined,signal:controller.signal});
  if(version!==generation)throw new DOMException('Session changed','AbortError');
  if(response.status===401){window.dispatchEvent(new Event('dotboard-auth-required'));throw new Error('La sesión debe renovarse.');}
  return response as Response;
 }catch(error){if(error instanceof Error&&/interaction_required|login_required|no_tokens_found/i.test(error.message))window.dispatchEvent(new Event('dotboard-auth-required'));throw error;}
 finally{active.delete(controller);init.signal?.removeEventListener('abort',abort);}
}
export async function downloadAuthenticated(path:string,name:string){const response=await apiFetch(path);if(!response.ok)throw new Error('Download failed');const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),0);}
