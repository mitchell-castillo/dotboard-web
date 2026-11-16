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
 await page.screenshot({path:'synthetic-ui.png',fullPage:true});
 console.log('PASS: interrupted import reuses envelope; create/edit persist across reload; initialized UI does not offer replacement. Synthetic transport only, not backend integration.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
