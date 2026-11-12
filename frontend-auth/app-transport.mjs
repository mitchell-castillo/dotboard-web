import {readOnlyRejection} from './read-only-policy.mjs';
import {DotBoardTransport} from './transport.mjs';
import {verifyAccessToken} from './identity-verification.mjs';
import {verifyHumanSession} from './identity-session.mjs';
export class PopupSessionTransport extends DotBoardTransport {
 constructor(config,msal,fetchImpl=fetch,verify=verifyAccessToken,session=verifyHumanSession){super(config,msal,fetchImpl);this.verify=verify;this.session=session;this.generation=0;this.authorized=null;this.controller=null;}
 async initialize(){await this.msal.initialize();return null;}
 invalidate(){this.generation++;this.controller?.abort();this.authorized=null;this.msal.setActiveAccount(null);return this.msal.clearCache().catch(()=>{});}
 async login(){
  if(this.interacting)throw Error('Authentication already in progress');
  this.interacting=true;const clearing=this.invalidate();const generation=this.generation;this.controller=new AbortController();let response;
  try{
   await clearing; if(generation!==this.generation)throw Error('Authentication cancelled');
   response=await this.msal.acquireTokenPopup({scopes:[this.config.apiScope],prompt:'select_account'});
   if(generation!==this.generation||!response?.account)throw Error('Authentication cancelled');
   const verified=await this.verify(response.accessToken);
   await this.session(response.accessToken,verified,{signal:this.controller.signal,fetchImpl:this.fetchImpl});
   if(generation!==this.generation)throw Error('Authentication cancelled');
   this.msal.setActiveAccount(response.account);this.authorized=response.account.homeAccountId;
   return response.account;
  }catch{await this.invalidate();throw Error('Session verification failed');}
  finally{response=null;this.interacting=false;}
 }
 async logout(){if(this.interacting)throw Error('Authentication already in progress');this.interacting=true;const account=this.msal.getActiveAccount();try{await this.invalidate();await this.msal.logoutPopup({account,postLogoutRedirectUri:this.config.redirectUri});}finally{await this.invalidate();this.interacting=false;}}
 async request(path,options={}){
  const denied=readOnlyRejection(options.method??'GET');if(denied)return denied;
  if(!this.authorized||this.msal.getActiveAccount()?.homeAccountId!==this.authorized)throw Error('Verified session required');
  const generation=this.generation;
  const transport=new DotBoardTransport(this.config,this.msal,(url,init)=>{
   if(generation!==this.generation||this.msal.getActiveAccount()?.homeAccountId!==this.authorized)throw Error('Session changed');
   return this.fetchImpl(url,init);
  });
  return transport.request(path,options);
 }
}
