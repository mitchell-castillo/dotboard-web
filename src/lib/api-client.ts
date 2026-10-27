import {createApiClient} from './api-core';
export const ACCESS_LOST='dotboard:access-lost';
let client:ReturnType<typeof createApiClient>|undefined;
export function getApiClient(){
  if(!client)client=createApiClient({baseUrl:import.meta.env.VITE_API_BASE_URL??'',allowLocalHttp:import.meta.env.DEV,onAccessLost:()=>window.dispatchEvent(new Event(ACCESS_LOST))});
  return client;
}
export function apiRequest(path:string,init?:RequestInit){return getApiClient().request(path,init);}
export async function downloadInstructions(path:string){
  const response=await apiRequest(path,{cache:'no-store'});
  if(!response.ok)throw new Error('No se pudo descargar el documento.');
  const objectUrl=URL.createObjectURL(await response.blob());const anchor=document.createElement('a');anchor.href=objectUrl;anchor.download='instrucciones.md';anchor.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),0);
}
