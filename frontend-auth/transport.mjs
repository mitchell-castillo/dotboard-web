// Configuration is public, operator-controlled build/deployment input. No secrets.
export function validateConfig(config, pageOrigin) {
  if (!config || config.provider !== 'entra') throw new Error('Access is not configured.');
  const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!guid.test(config.clientId ?? '') || !guid.test(config.tenantId ?? '')) throw new Error('Dedicated Entra tenant/client are required.');
  const api = new URL(config.apiBaseUrl); const redirect = new URL(config.redirectUri);
  if (api.protocol !== 'https:' || api.username || api.password || api.search || api.hash
      || redirect.protocol !== 'https:' || redirect.origin !== pageOrigin || redirect.username || redirect.password || redirect.search || redirect.hash)
    throw new Error('Approved HTTPS API and same-origin redirect are required.');
  // Exact verified API identifier only; the actual delegated scope remains deployment input.
  const verifiedHttpsScopePrefix = 'https://remindmeapp.onmicrosoft.com/8f4aea5c-0f25-465e-91ea-e035233859c6/';
  const scope = config.apiScope;
  const allowedHttpsScope = typeof scope === 'string'
    && scope.startsWith(verifiedHttpsScopePrefix)
    && /^[A-Za-z][A-Za-z0-9_.-]*$/.test(scope.slice(verifiedHttpsScopePrefix.length));
  if (typeof scope !== 'string' || (!scope.startsWith('api://') && !allowedHttpsScope)
      || /\s/.test(scope) || scope.endsWith('/.default')) throw new Error('Explicit delegated DotBoard API scope is required.');
  return Object.freeze({ ...config, apiBaseUrl: api.href.replace(/\/$/, ''), redirectUri: redirect.href });
}

// Caller must supply an initialized official MSAL instance; dependency injection is for tests only.
export class DotBoardTransport {
  constructor(config, msal, fetchImpl = fetch) { this.config=config; this.msal=msal; this.fetchImpl=fetchImpl; this.interacting=false; }
  async initialize() {
    await this.msal.initialize();
    const response = await this.msal.handleRedirectPromise();
    if (response?.account) this.msal.setActiveAccount(response.account);
    // Never choose the first cached account or fall back to an email/display name.
    return this.msal.getActiveAccount();
  }
  async login() {
    if(this.interacting) throw new Error('Authentication is already in progress.');
    this.interacting=true;
    try { await this.msal.loginRedirect({scopes:[this.config.apiScope],prompt:'select_account'}); }
    catch(error) { this.interacting=false; throw error; }
  }
  async logout() {
    if(this.interacting) throw new Error('Authentication is already in progress.');
    this.interacting=true;
    try { await this.msal.logoutRedirect({account:this.msal.getActiveAccount(),postLogoutRedirectUri:this.config.redirectUri}); }
    catch(error) {this.interacting=false; throw error;}
  }
  /** @param {string} path @param {{method?:string,body?:unknown,signal?:AbortSignal}} options */
  async request(path, {method='GET',body,signal}={}) {
    if(!/^\/(workspace(?:\/[^?#]*)?|session|projects\/[^/?#]+\/pending)(\?[^#]*)?$/.test(path)
       || path.includes('\\') || path.split(/[/?]/).includes('..')) throw new Error('Unsupported API path.');
    const account=this.msal.getActiveAccount();
    if(!account) throw new Error('Sign in before accessing DotBoard.');
    // No automatic interactive redirect during background refresh or mutation.
    const result=await this.msal.acquireTokenSilent({account,scopes:[this.config.apiScope]});
    if(!result.accessToken || result.account?.homeAccountId !== account.homeAccountId) throw new Error('Verified API access token unavailable.');
    const headers={Authorization:`Bearer ${result.accessToken}`};
    if(body!==undefined) headers['Content-Type']='application/json';
    return this.fetchImpl(this.config.apiBaseUrl+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal,
      cache:'no-store',credentials:'omit',redirect:'error'});
  }
  mutate(operation, revision, requestId, signal) {
    if(!Number.isSafeInteger(revision)||revision<0||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId??''))) throw new Error('Revision and stable requestId are required.');
    // Preserve the caller's operation and idempotency ID across retry. No auto-retry or local overwrite.
    return this.request('/workspace',{method:'POST',body:{revision,requestId,operation},signal});
  }
}
