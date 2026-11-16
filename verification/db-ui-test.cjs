const { chromium }=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // Reject any external destination; all tests operate only on the local mock.
 await page.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'?route.continue():route.abort();});
 await page.goto('http://127.0.0.1:5179/ui-synthetic.html');
 await page.getByText('Prepara tu DotBoard').waitFor();
 const picker=page.getByRole('button',{name:'Seleccionar archivo JSON',exact:true});
 assert.equal(await picker.isEnabled(),true);
 const importButton=page.getByRole('button',{name:'Importar tablero actual',exact:true});
 assert.equal(await importButton.isDisabled(),true);
 assert.equal(await importButton.evaluate(el=>getComputedStyle(el).cursor),'not-allowed');
 // A real user click must emit a native chooser, not merely allow setInputFiles.
 const chooserPromise=page.waitForEvent('filechooser');
 await picker.click();const chooser=await chooserPromise;
 assert.equal(await chooser.element().getAttribute('type'),'file');
 // Cancel then reopen by keyboard; neither action may import anything.
 await chooser.setFiles([]);
 assert.equal(await picker.isEnabled(),true);
 const reopen=page.waitForEvent('filechooser');await picker.focus();await page.keyboard.press('Enter');await (await reopen).setFiles([]);
 assert.equal(await page.evaluate(()=>window.testRequests.filter(r=>r.path==='/workspace/current-import').length),0);
 await page.evaluate(()=>sessionStorage.setItem('qa-drop-import','1'));
 await page.locator('input[type=file]').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'dot-board-local-backup',formatVersion:1,revision:7,workspace:{boards:[],archivedCards:[]}}))});
 await page.getByRole('button',{name:'Importar tablero actual'}).click();
 await page.getByText('Synthetic interrupted response',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Recuperar el mismo envío'}).click();
 await page.getByRole('button',{name:'Create board',exact:true}).first().waitFor();
 const imports=await page.evaluate(()=>window.testRequests.filter(r=>r.path==='/workspace/current-import'));
 assert.equal(imports.length,2);assert.deepEqual(imports[0].body,imports[1].body);
 await page.getByRole('button',{name:'Create board',exact:true}).first().click();
 await page.getByLabel('Name',{exact:true}).fill('Synthetic board');
 await page.getByRole('dialog').getByRole('button',{name:'Create board',exact:true}).click();
 await page.getByRole('button',{name:'Edit board',exact:true}).waitFor();
 await page.reload();
 await page.getByRole('button',{name:'Edit board',exact:true}).click();
 await page.getByLabel('Name',{exact:true}).fill('Synthetic board edited');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.reload();
 await page.getByRole('button',{name:'Edit board',exact:true}).waitFor();
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('dotboard-synthetic-qa')));
 assert.equal(state.workspace.boards.length,1);assert.equal(state.workspace.boards[0].name,'Synthetic board edited');assert.equal(state.workspace.revision,9);
 assert.equal(await page.getByText('Prepara tu DotBoard').count(),0);
 assert.deepEqual(errors,[]);

 // Exercise actual browser-native fetch default in both transports; local route only.
 await page.route('http://127.0.0.1:5179/api/workspace',route=>route.fulfill({status:200,contentType:'application/json',body:'{"synthetic":true}'}));
 const nativeResult=await page.evaluate(async()=>{
  const {DotBoardTransport}=await import('/transport.mjs');
  const {PopupSessionTransport}=await import('/app-transport.mjs');
  const account={homeAccountId:'synthetic-browser-account'};let active=account;
  const msal={getActiveAccount:()=>active,setActiveAccount:a=>active=a,clearCache:async()=>{},acquireTokenSilent:async()=>({account,accessToken:'synthetic-only'}),acquireTokenPopup:async()=>({account,accessToken:'synthetic-only'})};
  const config={apiScope:'synthetic',apiBaseUrl:location.origin+'/api',redirectUri:location.origin+'/'};
  const base=new DotBoardTransport(config,msal);
  const first=await (await base.request('/workspace')).json();
  const popup=new PopupSessionTransport(config,msal,undefined,async()=>({verified:true}),async()=>({authenticated:true}));
  await popup.login();const second=await (await popup.request('/workspace')).json();
  return [first.synthetic,second.synthetic];
 });
 assert.deepEqual(nativeResult,[true,true]);
 console.log('PASS: browser-native default fetch in base and popup transports without Illegal invocation.');
 let freshGetCount=100;
 await page.route('http://127.0.0.1:5179/fresh-api/workspace',route=>{assert.equal(route.request().method(),'GET');return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({workspace:{revision:++freshGetCount,boards:[]}})});});

 // Fresh reads use native authenticated fetch, never the rendered workspace cache.
 const freshReads=await page.evaluate(async()=>{
  const {readFreshWorkspace}=await import('/fresh-workspace.mjs');
  const {DotBoardTransport}=await import('/transport.mjs');
  const account={homeAccountId:'synthetic-browser-account'};let renewals=0;
  const msal={getActiveAccount:()=>account,acquireTokenSilent:async()=>{renewals++;return {account,accessToken:'synthetic-only'};}};
  const transport=new DotBoardTransport({apiScope:'synthetic',apiBaseUrl:location.origin+'/fresh-api'},msal);
  const api=path=>transport.request(path.slice(4));
  const first=await readFreshWorkspace(api),second=await readFreshWorkspace(api);
  return {revisions:[first.revision,second.revision],renewals};
 });
 assert.deepEqual(freshReads,{revisions:[101,102],renewals:2});
 console.log('PASS: each fresh read makes a separate native GET and silent token acquisition.');
 await page.screenshot({path:'synthetic-ui.png',fullPage:true});
 console.log('PASS: interrupted import reuses envelope; create/edit persist across reload; initialized UI does not offer replacement. Synthetic transport only, not backend integration.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
