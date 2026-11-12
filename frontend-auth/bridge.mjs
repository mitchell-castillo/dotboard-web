import {broadcastResponseToMainFrame} from '@azure/msal-browser/redirect-bridge';
// Never log authentication responses or error objects.
broadcastResponseToMainFrame().catch(()=>{document.querySelector('#status').textContent='No se completó la respuesta. Cierra esta ventana y vuelve a intentarlo.';});
