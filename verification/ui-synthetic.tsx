// Synthetic-only transport. Never included in a production build.
import React from 'react';
import {createRoot} from 'react-dom/client';
import BoardApp from './app/board-app';
import {bindTransport} from './lib/api-client';
import './app/globals.css';
const key='dotboard-synthetic-qa';
const requests:any[]=[];(window as any).testRequests=requests;
const read=()=>JSON.parse(localStorage.getItem(key)||'null');
const write=(state:any)=>localStorage.setItem(key,JSON.stringify(state));
bindTransport({request:async(path:string,options:any)=>{
 requests.push(JSON.parse(JSON.stringify({path,method:options.method,body:options.body})));
 let state=read();
 if(options.method==='GET')return Response.json(state?{workspace:state.workspace}:{error:'workspace_not_initialized'},{status:state?200:409});
 const body=options.body;
 if(state?.receipts[body.requestId])return Response.json(state.receipts[body.requestId]);
 if(path==='/workspace/current-import'){
  if(state)return Response.json({error:'workspace_exists'},{status:409});
  state={workspace:{...body.backup.workspace,revision:body.backup.revision},receipts:{}};
  const result={workspace:state.workspace,acceptedRevision:state.workspace.revision};
  state.receipts[body.requestId]=result;write(state);
  if(sessionStorage.getItem('qa-drop-import')==='1'){sessionStorage.removeItem('qa-drop-import');throw Error('Synthetic interrupted response');}
  return Response.json(result);
 }
 if(path==='/workspace'&&state){
  const w=state.workspace,op=body.operation;
  if(body.revision!==w.revision)return Response.json({error:'revision_conflict'},{status:409});
  let id=op.boardId;
  if(op.action==='create-board'){id=crypto.randomUUID();w.boards.push({id,name:op.name,description:op.description,color:op.color,columns:['To do','In progress','Done'].map(name=>({id:crypto.randomUUID(),name,cards:[]}))});}
  else if(op.action==='update-board'){const b=w.boards.find((b:any)=>b.id===id);Object.assign(b,{name:op.name,description:op.description,color:op.color});}
  else throw Error('Unsupported synthetic operation '+op.action);
  w.revision++;const result={workspace:w,result:{id}};state.receipts[body.requestId]=result;write(state);return Response.json(result);
 }
 throw Error('Unexpected synthetic route '+path);
}} as any);
createRoot(document.getElementById('root')!).render(<BoardApp/>);
