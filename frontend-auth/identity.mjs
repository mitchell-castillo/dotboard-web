import {PublicClientApplication,BrowserCacheLocation} from '@azure/msal-browser';
import {policy,assertOrigin,verifyAccessToken} from './identity-verification.mjs';
import {verifyHumanSession} from './identity-session.mjs';
import './identity.css';
const button=document.querySelector('#login');
const sessionButton=document.querySelector('#session');
const clear=document.querySelector('#clear');
const output=document.querySelector('#result');
const status=document.querySelector('#status');
let client, busy=false, generation=0, controller;
function erase(){generation++;controller?.abort();output.textContent='';status.textContent='Resultado oculto. Vuelve a verificar si lo necesitas.';}
function navigate(){erase();void client?.clearCache().catch(()=>{});}
window.addEventListener('pagehide',navigate);
window.addEventListener('popstate',navigate);
clear.addEventListener('click',()=>{erase();void client?.clearCache().catch(()=>{});});
(async()=>{try{
 assertOrigin(location.origin);
 if(window.self!==window.top)throw Error('Top level required');
 client=new PublicClientApplication({auth:{clientId:policy.client,authority:`https://login.microsoftonline.com/${policy.tenant}`,
 redirectUri:policy.origin+'/',postLogoutRedirectUri:policy.origin+'/'},cache:{cacheLocation:BrowserCacheLocation.MemoryStorage},
 system:{loggerOptions:{loggerCallback:()=>{},piiLoggingEnabled:false}}});
 await client.initialize(); button.disabled=false;sessionButton.disabled=false;status.textContent='Listo para verificar tu identidad o el acceso a la API.';
}catch{status.textContent='No se puede iniciar en esta dirección.';}})();
async function run(checkSession){
 if(busy||!client)return;busy=true;button.disabled=true;sessionButton.disabled=true;clear.disabled=true;erase();const current=generation;
 controller=new AbortController();let response;
 status.textContent='Completa el inicio de sesión en la ventana de Microsoft.';
 try{
 response=await client.acquireTokenPopup({scopes:[policy.scope],prompt:'select_account'});
 const selected=await verifyAccessToken(response.accessToken);
 if(current!==generation)return;
 const result=checkSession?await verifyHumanSession(response.accessToken,selected,{signal:controller.signal}):selected;
 if(current!==generation)return;
 output.textContent=JSON.stringify(result,null,2);
 status.textContent=checkSession?'Sesión de Juan verificada en la API. No se han leído ni modificado tableros.':'Firma e identidad verificadas. Este resultado no concede acceso a los tableros.';
 }catch{if(current===generation){output.textContent='';status.textContent='La verificación no se completó. Puedes volver a intentarlo.';}}
 finally{response=null;controller?.abort();try{await client.clearCache();}catch{output.textContent='';status.textContent='Cierra esta pestaña antes de volver a verificar.';}finally{busy=false;button.disabled=false;sessionButton.disabled=false;clear.disabled=false;}}
}
button.addEventListener('click',()=>run(false));
sessionButton.addEventListener('click',()=>run(true));
