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
 await page.screenshot({path:'synthetic-ui.png',fullPage:true});
 console.log('PASS: interrupted import reuses envelope; create/edit persist across reload; initialized UI does not offer replacement. Synthetic transport only, not backend integration.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
