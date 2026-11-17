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
  else if(op.action==='trash-board'){if(sessionStorage.getItem('qa-reject-trash')==='1'){sessionStorage.removeItem('qa-reject-trash');return Response.json({error:'invalid_operation'},{status:400});}const b=w.boards.find((b:any)=>b.id===id);if(!b)return Response.json({error:'board_not_found'},{status:404});w.trashedBoards??=[];w.trashedBoards.push({id:crypto.randomUUID(),board:b,archivedCards:(w.archivedCards??[]).filter((a:any)=>a.boardId===id),trashedAt:Date.now(),expiresAt:Date.now()+30*86400000});w.boards=w.boards.filter((b:any)=>b.id!==id);w.archivedCards=(w.archivedCards??[]).filter((a:any)=>a.boardId!==id);}
  else if(op.action==='restore-board'){const t=w.trashedBoards.find((t:any)=>t.id===op.trashId);w.boards.push(t.board);w.archivedCards.push(...t.archivedCards);w.trashedBoards=w.trashedBoards.filter((t:any)=>t.id!==op.trashId);id=t.board.id;}
  else if(op.action==='update-reminder-local'){
   if(sessionStorage.getItem('qa-reminder-conflict')==='1'){sessionStorage.removeItem('qa-reminder-conflict');return Response.json({error:'revision_conflict'},{status:409});}
   if(sessionStorage.getItem('qa-reminder-local-conflict')==='1'){sessionStorage.removeItem('qa-reminder-local-conflict');return Response.json({error:'invalid_operation'},{status:409});}
   const series=w.reminders.series.find((r:any)=>r.id===op.seriesId);
   if((series.local.revision??0)!==op.expectedLocalRevision)return Response.json({error:'invalid_operation'},{status:409});
   if((series.local.title??'')!==op.title||(series.local.notes??'')!==op.notes){
    if(op.title)series.local.title=op.title;else delete series.local.title;
    if(op.notes)series.local.notes=op.notes;else delete series.local.notes;
    series.local.revision=(series.local.revision??0)+1;
   }
  }
  else if(op.action==='edit-reminder-occurrence'){
   if(sessionStorage.getItem('qa-reminder-conflict')==='1'){sessionStorage.removeItem('qa-reminder-conflict');return Response.json({error:'revision_conflict'},{status:409});}
   if(sessionStorage.getItem('qa-reminder-expired')==='1'){sessionStorage.removeItem('qa-reminder-expired');return Response.json({error:'session_expired'},{status:401});}
   const series=w.reminders.series.find((r:any)=>r.id===op.seriesId),occurrence=series.occurrences.find((o:any)=>o.id===op.occurrenceId);
   if((occurrence.localRevision??0)!==op.expectedLocalRevision)return Response.json({error:'invalid_operation'},{status:409});
   if(op.change==='complete'){occurrence.state='completed';occurrence.completedAt=Date.now();}else occurrence.snoozedUntil=op.snoozedUntil;
   occurrence.localRevision=(occurrence.localRevision??0)+1;
  }
  else throw Error('Unsupported synthetic operation '+op.action);
  w.revision++;const result={workspace:w,result:{id}};state.receipts[body.requestId]=result;write(state);
  if(op.action==='update-reminder-local'&&sessionStorage.getItem('qa-drop-reminder-local')==='1'){sessionStorage.removeItem('qa-drop-reminder-local');throw Error('Synthetic interrupted response');}
  return Response.json(result);
 }
 throw Error('Unexpected synthetic route '+path);
}} as any);
createRoot(document.getElementById('root')!).render(<BoardApp/>);
