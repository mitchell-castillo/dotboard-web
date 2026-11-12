import {PublicClientApplication,BrowserCacheLocation} from '@azure/msal-browser';
import {policy,assertOrigin,verifyAccessToken} from './identity-verification.mjs';
import './identity.css';
const button=document.querySelector('#login');
const clear=document.querySelector('#clear');
const output=document.querySelector('#result');
const status=document.querySelector('#status');
let client, busy=false, generation=0;
function erase(){generation++;output.textContent='';status.textContent='Resultado oculto. Vuelve a verificar si lo necesitas.';}
window.addEventListener('pagehide',erase);
window.addEventListener('popstate',erase);
clear.addEventListener('click',()=>{erase();void client?.clearCache().catch(()=>{});});
(async()=>{try{
 assertOrigin(location.origin);
 if(window.self!==window.top)throw Error('Top level required');
 client=new PublicClientApplication({auth:{clientId:policy.client,authority:`https://login.microsoftonline.com/${policy.tenant}`,
 redirectUri:policy.origin+'/',postLogoutRedirectUri:policy.origin+'/'},cache:{cacheLocation:BrowserCacheLocation.MemoryStorage},
 system:{loggerOptions:{loggerCallback:()=>{},piiLoggingEnabled:false}}});
 await client.initialize(); button.disabled=false;status.textContent='Listo para verificar tu identidad.';
}catch{status.textContent='No se puede iniciar en esta dirección.';}})();
button.addEventListener('click',async()=>{
 if(busy||!client)return;busy=true;button.disabled=true;clear.disabled=true;erase();const current=generation;
 status.textContent='Completa el inicio de sesión en la ventana de Microsoft.';
 try{
 const response=await client.acquireTokenPopup({scopes:[policy.scope],prompt:'select_account'});
 const selected=await verifyAccessToken(response.accessToken);
 if(current!==generation)return;
 output.textContent=JSON.stringify(selected,null,2);
 status.textContent='Firma e identidad verificadas. Este resultado no concede acceso a los tableros.';
 }catch{if(current===generation){output.textContent='';status.textContent='La verificación no se completó. Puedes volver a intentarlo.';}}
 finally{try{await client.clearCache();}catch{output.textContent='';status.textContent='Cierra esta pestaña antes de volver a verificar.';}finally{busy=false;button.disabled=false;clear.disabled=false;}}
});
