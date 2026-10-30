import { PublicClientApplication, BrowserCacheLocation } from '@azure/msal-browser';
import {validateConfig,DotBoardTransport} from './transport.mjs';
export function createDotBoardTransport(publicConfig, pageOrigin=window.location.origin) {
  const config=validateConfig(publicConfig,pageOrigin);
  const client=new PublicClientApplication({auth:{clientId:config.clientId,
    authority:`https://login.microsoftonline.com/${config.tenantId}`,redirectUri:config.redirectUri,
    postLogoutRedirectUri:config.redirectUri,navigateToLoginRequestUrl:false},
    cache:{cacheLocation:BrowserCacheLocation.SessionStorage}});
  return new DotBoardTransport(config,client);
}
