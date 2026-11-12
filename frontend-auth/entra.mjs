import { PublicClientApplication, BrowserCacheLocation } from '@azure/msal-browser';
import {validateConfig} from './transport.mjs';
import {PopupSessionTransport} from './app-transport.mjs';
export function createDotBoardTransport(publicConfig, pageOrigin=window.location.origin) {
  const config=validateConfig(publicConfig,pageOrigin);
  const client=new PublicClientApplication({auth:{clientId:config.clientId,
    authority:`https://login.microsoftonline.com/${config.tenantId}`,redirectUri:config.redirectUri,
    postLogoutRedirectUri:config.redirectUri,navigateToLoginRequestUrl:false},
    cache:{cacheLocation:BrowserCacheLocation.MemoryStorage},system:{loggerOptions:{loggerCallback:()=>{},piiLoggingEnabled:false}}});
  return new PopupSessionTransport(config,client);
}
