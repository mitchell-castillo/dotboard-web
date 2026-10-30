import {PendingWrite} from "@/lib/pending-write";
import {apiFetch} from "@/lib/api-client";


import { useState, useEffect, useRef, useCallback, type FormEvent, type DragEvent } from "react";
import { LayoutGrid, Plus, Columns3, Check, LockKeyhole, Sparkles, Pencil, X, GripVertical, Loader2, Trash2, AlertCircle, Repeat2, PanelLeftClose, PanelLeftOpen, Moon, Sun, Archive, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { BOARD_COLORS, LABELS, expandsDescriptionOnOpen, type Workspace, type Card, type Board } from "@/lib/board-types";
import type { Action } from "@/lib/workspace-store";
import ColumnTriggers from "./column-triggers";
import CardArchive from "./card-archive";
import BackupDownload from "./backup-download";
import LocalBackups from "./local-backups";
import CardComments from "./card-comments";
import CardCreatedAt from "./card-created-at";
import ProjectInstructions from "./project-instructions";
import DescriptionEditor from "./rich-description";
import ArchiveUndo, {type UndoArchive} from "./archive-undo";
import {descriptionPlainText} from "@/lib/description-format";
import {formatTriggerDate, formatTriggerShortDate} from "@/lib/column-triggers";

type Editor = {kind:"board";boardId?:string}|{kind:"card";cardId?:string}|{kind:"column";boardId:string;columnId?:string};
type Draft={name:string;description:string;color:string;title:string;label:string;boardId:string;columnId:string;position:number;expandDescriptionOnOpen:boolean};
const blankDraft:Draft={name:"",description:"",color:BOARD_COLORS[0],title:"",label:"",boardId:"",columnId:"",position:0,expandDescriptionOnOpen:true};
type Confirmation={title:string;description:string;operation:Action};
type Tool={name:string;title:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean;untrustedContentHint:boolean};execute:(input:unknown)=>unknown|Promise<unknown>};

export default function BoardApp(){
  const [workspace,setWorkspace]=useState<Workspace>({boards:[],revision:0});
  const [selected,setSelected]=useState("");
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const [darkMode,setDarkMode]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [editor,setEditor]=useState<Editor|null>(null);
  const [instructionsBoardId,setInstructionsBoardId]=useState<string|null>(null);
  const [instructionsBoardSnapshot,setInstructionsBoardSnapshot]=useState<Board|null>(null);
  const [draft,setDraft]=useState<Draft>(blankDraft);
  const [formError,setFormError]=useState("");
  const [confirmation,setConfirmation]=useState<Confirmation|null>(null);
  const [descriptionExpanded,setDescriptionExpanded]=useState(false);
  const [editorSession,setEditorSession]=useState(0);
  const [undoArchives,setUndoArchives]=useState<UndoArchive[]>([]);
  const deleteCancelRef=useRef<HTMLButtonElement>(null);
  const editorReturnFocus=useRef<HTMLElement|null>(null);
  const instructionsReturnFocus=useRef<HTMLElement|null>(null);
  const editorInitialInput=useRef<HTMLInputElement>(null);
  const boardExpected=useRef<{name:string;description:string;color:string}|undefined>(undefined);
  const [dropTarget,setDropTarget]=useState("");
  const [draggingCard,setDraggingCard]=useState("");
  const [cardTarget,setCardTarget]=useState<{columnId:string;cardId:string;side:"before"|"after"}|null>(null);
  const stateRef=useRef(workspace);
  const lock=useRef(false);
  const uncertainMutation=useRef(new PendingWrite());
  const [recoveryAvailable,setRecoveryAvailable]=useState(false);
  const archiveExpected=useRef<{boardId:string;columnId:string;title:string;description:string;label:Card["label"]}|undefined>(undefined);
  const refreshing=useRef(false);
  const dragId=useRef("");
  const columnDrag=useRef<{boardId:string;columnId:string}|null>(null);
  const [draggingColumn,setDraggingColumn]=useState("");
  const [columnTarget,setColumnTarget]=useState<{id:string;side:"before"|"after"}|null>(null);
  const board=workspace.boards.find(b=>b.id===selected)??workspace.boards[0];
  const total=board?.columns.reduce((sum,c)=>sum+c.cards.length,0)??0;
  const selectedTarget=workspace.boards.find(b=>b.id===draft.boardId);
  const editingBoard=editor?.kind==="board"?workspace.boards.find(b=>b.id===editor.boardId):undefined;
  const instructionsBoard=instructionsBoardId?(workspace.boards.find(b=>b.id===instructionsBoardId)??instructionsBoardSnapshot):null;

  const updateState=useCallback((next:Workspace)=>{stateRef.current=next;setWorkspace(next);},[]);
  const load=useCallback(async(silent=false)=>{
    if(refreshing.current||(silent&&lock.current))return;
    refreshing.current=true;
    if(!silent){setLoading(true);setError("");}
    try{const r=await apiFetch("/api/workspace",{cache:"no-store"});const data=await r.json() as {workspace:Workspace;error?:string};if(!r.ok)throw new Error(data.error);if(data.workspace.revision>=stateRef.current.revision)updateState(data.workspace);}
    catch(e){setError(e instanceof Error?e.message:"We couldn't load your boards.");}
    finally{refreshing.current=false;if(!silent)setLoading(false);}
  },[updateState]);
  const refreshInstructionsWorkspace=useCallback(()=>load(true),[load]);
  useEffect(()=>{queueMicrotask(()=>void load());},[load]);
  useEffect(()=>{
    queueMicrotask(()=>{try{setSidebarCollapsed(localStorage.getItem("dot-board.sidebarCollapsed")==="true");
    const dark=localStorage.getItem("dot-board.theme")==="dark"; document.documentElement.dataset.theme=dark?"dark":"light"; setDarkMode(dark);}catch{}});
  },[]);
  function toggleTheme(){
    const dark=!darkMode;
    setDarkMode(dark);
    document.documentElement.dataset.theme=dark?"dark":"light";
    try{localStorage.setItem("dot-board.theme",dark?"dark":"light");}catch{}
  }
  function toggleSidebar(){
    const collapsed=!sidebarCollapsed;
    setSidebarCollapsed(collapsed);
    try{localStorage.setItem("dot-board.sidebarCollapsed",String(collapsed));}catch{}
  }
  useEffect(()=>{
    const active=workspace.boards.flatMap(b=>b.columns.flatMap(c=>(c.triggers??[]).filter(t=>t.enabled)));
    if(!active.length)return;
    const refresh=()=>{if(document.visibilityState==="visible")void load(true);};
    const interval=setInterval(refresh,60000);
    const now=Date.now();
    const next=Math.min(...active.filter(t=>!t.error&&t.nextRunAt>now).map(t=>t.nextRunAt));
    const timeout=Number.isFinite(next)?setTimeout(refresh,Math.min(2147483647,Math.max(1000,next-now+500))):undefined;
    document.addEventListener("visibilitychange",refresh);
    window.addEventListener("focus",refresh);
    return ()=>{clearInterval(interval);if(timeout!==undefined)clearTimeout(timeout);document.removeEventListener("visibilitychange",refresh);window.removeEventListener("focus",refresh);};
  },[workspace,load]);

  const sendMutation=useCallback(async(body:string)=>{
    if(lock.current)throw new Error("Wait for the previous change to finish.");
    lock.current=true;setBusy(true);setError("");setFormError("");
    try{
      const r=await apiFetch("/api/workspace",{method:"POST",headers:{"Content-Type":"application/json"},body});
      const data=await r.json() as {workspace?:Workspace;error?:string;result?:{id?:string;archiveId?:string};id?:string;archiveId?:string};
      if(data.workspace&&data.workspace.revision>=stateRef.current.revision)updateState(data.workspace);
      if(!r.ok){
        if(uncertainMutation.current.rejectDefinitively(r.status,data.error))setRecoveryAvailable(false);
        throw new Error(data.error==='revision_conflict'?'El cambio fue rechazado por una revisión más reciente. Recarga y revisa tu borrador antes de reenviarlo.':data.error??"No se pudo confirmar el cambio. El envío original se conserva.");
      }
      if(!data.workspace)throw new Error("El resultado no se confirmó; se conserva el envío original.");
      uncertainMutation.current.acknowledgeSuccess();setRecoveryAvailable(false);
      return data.result??data;
    }catch(e){setRecoveryAvailable(uncertainMutation.current.hasPending());const message=e instanceof Error?e.message:"Resultado incierto; recupera el envío original.";setError(message);setFormError(message);throw e;}
    finally{lock.current=false;setBusy(false);}
  },[updateState]);
  const mutate=useCallback(async(operation:Action)=>{
    if(lock.current)throw new Error("Wait for the previous change to finish.");
    const requestId="requestId" in operation?operation.requestId:crypto.randomUUID();
    const body=uncertainMutation.current.begin({revision:stateRef.current.revision,requestId,operation});
    return sendMutation(body);
  },[sendMutation]);
  async function recoverMutation(){try{await sendMutation(uncertainMutation.current.replay());}catch{/* existing error remains visible */}}

  useEffect(()=>{
    const context=(document as Document & {modelContext?:{registerTool:(tool:Tool,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const inputObject=(input:unknown)=>{if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Expected an object.");return input as Record<string,unknown>;};
    const required=(input:Record<string,unknown>,key:string)=>{if(typeof input[key]!=="string"||!(input[key] as string).trim())throw new Error("Missing "+key);return (input[key] as string).trim();};
    const tools:Tool[]=[
      {name:"create_board",title:"Create board",description:"Create and save a board with To do, In progress, and Done columns.",inputSchema:{type:"object",properties:{name:{type:"string",minLength:1,maxLength:120},description:{type:"string",maxLength:5000}},required:["name"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async(input)=>{const p=inputObject(input);const result=await mutate({action:"create-board",name:required(p,"name"),description:typeof p.description==="string"?p.description:"",color:BOARD_COLORS[0]});if(result.id)setSelected(result.id);return result;}},
      {name:"read_workspace",title:"Read boards",description:"Return the boards, columns, and cards in the current workspace.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>JSON.parse(JSON.stringify(stateRef.current))},
      {name:"create_card",title:"Create card",description:"Create and save a card in an existing board and column. Get their IDs with read_workspace.",inputSchema:{type:"object",properties:{boardId:{type:"string"},columnId:{type:"string"},title:{type:"string",minLength:1,maxLength:200},description:{type:"string",maxLength:5000}},required:["boardId","columnId","title"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async(input)=>{const p=inputObject(input);const b=required(p,"boardId");const result=await mutate({action:"create-card",boardId:b,columnId:required(p,"columnId"),title:required(p,"title"),description:typeof p.description==="string"?p.description:"",label:""});setSelected(b);return result;}},
      {name:"move_card",title:"Move card",description:"Move and save a card at the end of a column, on the same board or another board. Get the IDs with read_workspace.",inputSchema:{type:"object",properties:{cardId:{type:"string"},boardId:{type:"string"},columnId:{type:"string"}},required:["cardId","boardId","columnId"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async(input)=>{const p=inputObject(input);const b=required(p,"boardId");await mutate({action:"move-card",cardId:required(p,"cardId"),boardId:b,columnId:required(p,"columnId")});setSelected(b);return {moved:true,boardId:b};}}
    ];
    for(const tool of tools){try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
    return ()=>lifecycle.abort();
  },[mutate]);

  function openBoard(boardId?:string){editorReturnFocus.current=document.activeElement as HTMLElement|null;setDescriptionExpanded(false);const b=workspace.boards.find(b=>b.id===boardId);boardExpected.current=b?{name:b.name,description:b.description,color:b.color}:undefined;setDraft({...blankDraft,name:b?.name??"",description:b?.description??"",color:b?.color??BOARD_COLORS[workspace.boards.length%BOARD_COLORS.length]});setFormError("");setEditor({kind:"board",boardId});}
  function openColumn(columnId?:string){if(!board)return;editorReturnFocus.current=document.activeElement as HTMLElement|null;setDescriptionExpanded(false);const c=board.columns.find(c=>c.id===columnId);setDraft({...blankDraft,name:c?.name??"",boardId:board.id,columnId:columnId??"",position:c?board.columns.findIndex(item=>item.id===c.id):0});setFormError("");setEditor({kind:"column",boardId:board.id,columnId});}
  function openCard(columnId?:string,card?:Card){if(!board)return;editorReturnFocus.current=document.activeElement as HTMLElement|null;setEditorSession(value=>value+1);setDescriptionExpanded(!!card&&expandsDescriptionOnOpen(stateRef.current.boards.find(b=>b.id===board.id)));archiveExpected.current=card?{boardId:board.id,columnId:columnId??board.columns[0].id,title:card.title,description:card.description,label:card.label}:undefined;setDraft({...blankDraft,boardId:board.id,columnId:columnId??board.columns[0].id,title:card?.title??"",description:card?.description??"",label:card?.label??""});setFormError("");setEditor({kind:"card",cardId:card?.id});}
  function patchDraft(p:Partial<Draft>){setDraft(d=>({...d,...p}));}
  async function setDescriptionPreference(boardId:string,expanded:boolean,expected:boolean){if(busy||lock.current)return;try{await mutate({action:"set-board-description-preference",boardId,expanded,expected});}catch{}}
  async function submit(e:FormEvent){
    e.preventDefault();if(!editor||busy||lock.current||draft.description.length>5000)return;
    let operation:Action;
    if(editor.kind==="board"){operation=editor.boardId?{action:"update-board",boardId:editor.boardId,name:draft.name,description:draft.description,color:draft.color,expected:boardExpected.current}:{action:"create-board",name:draft.name,description:draft.description,color:draft.color,expandDescriptionOnOpen:draft.expandDescriptionOnOpen};}
    else if(editor.kind==="column"){operation=editor.columnId?{action:"update-column",boardId:editor.boardId,columnId:editor.columnId,name:draft.name,position:draft.position}:{action:"create-column",boardId:editor.boardId,name:draft.name};}
    else{const fields={boardId:draft.boardId,columnId:draft.columnId,title:draft.title,description:draft.description,label:draft.label as ""|"idea"|"task"|"urgent"};operation=editor.cardId?{action:"update-card",cardId:editor.cardId,expected:archiveExpected.current,...fields}:{action:"create-card",...fields};}
    try{const result=await mutate(operation);if(operation.action==="create-board"&&result.id)setSelected(result.id);if(editor.kind==="card")setSelected(draft.boardId);setEditor(null);}catch{}
  }
  async function confirmDelete(){if(!confirmation||busy||lock.current)return;try{await mutate(confirmation.operation);setConfirmation(null);setEditor(null);}catch{}}
  async function archiveCard(){
    if(editor?.kind!=="card"||!editor.cardId||busy||lock.current||draft.description.length>5000)return;
    try{const result=await mutate({action:"archive-card",cardId:editor.cardId,expected:archiveExpected.current,changes:{boardId:draft.boardId,columnId:draft.columnId,title:draft.title,description:draft.description,label:draft.label as ""|"idea"|"task"|"urgent"}});if(result.archiveId)setUndoArchives(entries=>[...entries,{cardId:editor.cardId!,archiveId:result.archiveId!,title:draft.title}]);setEditor(null);}catch{}
  }
  const dismissUndo=useCallback((archiveId:string)=>setUndoArchives(entries=>entries.filter(entry=>entry.archiveId!==archiveId)),[]);
  async function quickArchive(card:Card,columnId:string){
    if(busy||lock.current)return;
    try{const result=await mutate({action:"archive-card",cardId:card.id});if(result.archiveId)setUndoArchives(entries=>[...entries,{cardId:card.id,archiveId:result.archiveId!,title:card.title}]);requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>(`[data-add-column="${CSS.escape(columnId)}"]`)?.focus());}catch{}
  }
  async function undoArchive(entry:UndoArchive){
    if(busy||lock.current)return;
    const original=stateRef.current.archivedCards?.find(item=>item.archiveId===entry.archiveId);
    try{await mutate({action:"undo-archive",cardId:entry.cardId,archiveId:entry.archiveId});dismissUndo(entry.archiveId);if(original)setSelected(original.boardId);requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>(`[data-card-id="${CSS.escape(entry.cardId)}"] .card-open`)?.focus());}
    catch(e){setUndoArchives(entries=>entries.map(item=>item.archiveId===entry.archiveId?{...item,error:e instanceof Error?e.message:"No se pudo deshacer. Revisa el archivo antes de reintentar."}:item));}
  }
  function cardFromDrag(e:DragEvent){return dragId.current||e.dataTransfer.getData("text/plain");}
  function canDrag(e:DragEvent){return !busy&&!columnDrag.current&&!Array.from(e.dataTransfer.types).includes("application/x-dot-board-column")&&(!!dragId.current||Array.from(e.dataTransfer.types).includes("text/plain"));}
  function clearCardDrag(){dragId.current="";setDraggingCard("");setDropTarget("");setCardTarget(null);}
  function cardDropBefore(e:DragEvent<HTMLElement>){
    const cardId=cardFromDrag(e);
    const cards=Array.from(e.currentTarget.querySelectorAll<HTMLElement>(".task-card"));
    return cards.find(card=>{
      if(card.dataset.cardId===cardId)return false;
      const bounds=card.getBoundingClientRect();
      return e.clientY<bounds.top+bounds.height/2;
    })?.dataset.cardId;
  }
  function unchangedCardPosition(cardId:string,boardId:string,columnId:string,beforeId?:string){
    const column=stateRef.current.boards.find(b=>b.id===boardId)?.columns.find(c=>c.id===columnId);
    const index=column?.cards.findIndex(c=>c.id===cardId)??-1;
    return index>=0&&column?.cards[index+1]?.id===beforeId;
  }
  function previewCardDrop(e:DragEvent<HTMLElement>,columnId:string){
    if(!board)return;
    e.preventDefault();e.dataTransfer.dropEffect="move";setDropTarget(columnId);
    const beforeId=cardDropBefore(e);
    const last=board.columns.find(c=>c.id===columnId)?.cards.slice().reverse().find(card=>card.id!==dragId.current);
    const target=unchangedCardPosition(dragId.current,board.id,columnId,beforeId)?null:
      beforeId?{columnId,cardId:beforeId,side:"before" as const}:last?{columnId,cardId:last.id,side:"after" as const}:null;
    setCardTarget(previous=>previous?.columnId===target?.columnId&&previous?.cardId===target?.cardId&&previous?.side===target?.side?previous:target);
  }
  async function drop(e:DragEvent,boardId:string,columnId:string,beforeId?:string){
    e.preventDefault();e.stopPropagation();const cardId=cardFromDrag(e);clearCardDrag();
    if(!cardId||busy||cardId===beforeId||unchangedCardPosition(cardId,boardId,columnId,beforeId))return;
    try{await mutate({action:"move-card",cardId,boardId,columnId,...(beforeId?{beforeId}:{})});}catch{}
  }
  function clearColumnDrag(){columnDrag.current=null;setDraggingColumn("");setColumnTarget(null);}
  function columnDropSide(e:DragEvent<HTMLElement>):"before"|"after"{const bounds=e.currentTarget.getBoundingClientRect();return e.clientX<bounds.left+bounds.width/2?"before":"after";}
  function previewDrop(e:DragEvent<HTMLElement>,columnId:string){
    if(columnDrag.current&&columnDrag.current.boardId===board?.id&&!busy){
      e.preventDefault();e.dataTransfer.dropEffect="move";
      setColumnTarget(columnDrag.current.columnId===columnId?null:{id:columnId,side:columnDropSide(e)});
    }else if(canDrag(e))previewCardDrop(e,columnId);
  }
  async function dropOnColumn(e:DragEvent<HTMLElement>,columnId:string){
    const source=columnDrag.current;
    if(!source){if(canDrag(e)&&board)await drop(e,board.id,columnId,cardDropBefore(e));return;}
    e.preventDefault();e.stopPropagation();
    const side=columnDropSide(e);clearColumnDrag();
    if(!board||busy||source.boardId!==board.id||source.columnId===columnId)return;
    const from=board.columns.findIndex(c=>c.id===source.columnId);
    const target=board.columns.findIndex(c=>c.id===columnId);
    if(from<0||target<0)return;
    const insert=target+(side==="after"?1:0);
    const position=insert-(from<insert?1:0);
    if(position===from)return;
    try{await mutate({action:"move-column",boardId:board.id,columnId:source.columnId,position});}catch{}
  }
  async function moveColumnByKey(columnId:string,direction:number){
    if(!board||busy)return;
    const position=board.columns.findIndex(c=>c.id===columnId)+direction;
    if(position<0||position>=board.columns.length)return;
    try{await mutate({action:"move-column",boardId:board.id,columnId,position});}catch{}
  }
  async function moveCardByKey(columnId:string,cardId:string,direction:number){
    if(!board||busy)return;
    const cards=board.columns.find(c=>c.id===columnId)?.cards;
    const from=cards?.findIndex(card=>card.id===cardId)??-1;
    if(!cards||from<0||from+direction<0||from+direction>=cards.length)return;
    const beforeId=cards[from+(direction<0?-1:2)]?.id;
    try{await mutate({action:"move-card",cardId,boardId:board.id,columnId,...(beforeId?{beforeId}:{})});}catch{}
  }
  const commentCard=editor?.kind==="card"&&editor.cardId?workspace.boards.flatMap(b=>b.columns.flatMap(c=>c.cards)).find(c=>c.id===editor.cardId):undefined;
  const isEditing=editor&&(editor.kind==="board"?!!editor.boardId:editor.kind==="column"?!!editor.columnId:!!editor.cardId);
  const editorTitle=editor?.kind==="board"?(isEditing?"Edit board":"Create board"):editor?.kind==="column"?(isEditing?"Edit column":"Add column"):(isEditing?"Edit card":"New card");
  return <div className="app-shell">
    <aside id="workspace-sidebar" className="sidebar" hidden={sidebarCollapsed}>
      <a href="./" className="brand"><Columns3 size={25}/>DotBoard</a>
      <div className="space-label">PRIVATE WORKSPACE</div>
      <div className="workspace-name"><span className="workspace-avatar">d</span><div>dot’s projects<small>Synced privately</small></div></div>
      <div className="side-section"><span>My boards</span><button className="icon-button" onClick={()=>openBoard()} disabled={loading||busy} aria-label="Create board"><Plus size={18}/></button></div>
      <nav className="sidebar-scroll" aria-label="Boards">
        {workspace.boards.map(b=><button key={b.id} className={"board-nav"+(board?.id===b.id?" active":"")+(dropTarget===b.id?" drag-target":"")} onClick={()=>setSelected(b.id)} aria-current={board?.id===b.id?"page":undefined}
          onDragOver={e=>{if(canDrag(e)){e.preventDefault();e.dataTransfer.dropEffect="move";setDropTarget(b.id);setCardTarget(null);}}} onDragLeave={()=>setDropTarget("")} onDrop={e=>void drop(e,b.id,b.columns[0].id)} title={"Open "+b.name+" · Drop a card here to move it"}>
          <span className="board-color" style={{background:b.color}}/><span>{b.name}</span><span className="nav-count">{b.columns.reduce((s,c)=>s+c.cards.length,0)}</span>
        </button>)}
        <button className="new-board-nav" onClick={()=>openBoard()} disabled={loading||busy}><Plus size={17}/>Create board</button>
      </nav>
      <div className="sidebar-bottom"><LockKeyhole size={15}/><span>Private · Only you</span></div>
    </aside>
    <main className="main">
      <header className="topbar"><span><button type="button" className="icon-button sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarCollapsed?"Show sidebar":"Hide sidebar"} title={sidebarCollapsed?"Show sidebar":"Hide sidebar"} aria-expanded={!sidebarCollapsed} aria-controls="workspace-sidebar">{sidebarCollapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button><LayoutGrid size={17}/> My boards <span className="breadcrumb-slash">/</span><strong>{board?.name??"My workspace"}</strong></span>
        <div className="topbar-actions"><BackupDownload compact disabled={loading||busy}/><LocalBackups workspace={workspace} disabled={loading||busy||!!editor||!!confirmation||!!instructionsBoardId} onChange={updateState}/><span className="save-status" role="status">{loading||busy?<><Loader2 size={15} className="animate-spin"/><span className="save-status-label">{loading?"Loading…":"Saving…"}</span></>:error?<><AlertCircle size={15}/><span className="save-status-label">Check the notice</span></>:<><Check size={15}/><span className="save-status-label">Saved</span></>}</span><CardArchive workspace={workspace} busy={busy} loading={loading} mutate={mutate} onRestore={setSelected}/><button type="button" className="icon-button theme-toggle" onClick={toggleTheme} aria-label={darkMode?"Switch to light mode":"Switch to dark mode"} title={darkMode?"Switch to light mode":"Switch to dark mode"}>{darkMode?<Sun size={17}/>:<Moon size={17}/>}</button></div>
      </header>
      {(loading||busy)&&<div className="loading-bar"/>}
      <div className="board-heading"><div className="board-summary"><div className="board-title-row"><span className="board-color" style={{background:board?.color??BOARD_COLORS[0]}}/><h1>{board?.name??"My boards"}</h1>{board&&<span className="board-card-count">{total} {total===1?"card":"cards"}</span>}</div>{board?.description&&<p title={board.description}>{board.description}</p>}</div>
        {board&&<div className="board-actions"><button type="button" className="icon-button board-action instructions-toggle" onClick={()=>{instructionsReturnFocus.current=document.activeElement as HTMLElement|null;setInstructionsBoardSnapshot(board);setInstructionsBoardId(board.id);}} disabled={busy||loading} aria-label={"Instrucciones de "+board.name} title="Instrucciones del proyecto"><FileText size={16}/></button><button className="icon-button board-action" onClick={()=>openBoard(board.id)} disabled={busy} aria-label="Edit board" title="Edit board"><Pencil size={16}/></button><button className="button primary" onClick={()=>openCard()} disabled={busy}><Plus size={18}/> New card</button></div>}
      </div>
      {recoveryAvailable&&<div className="error-banner" role="status"><span>Resultado pendiente. La recuperación reenvía exactamente la revisión, operación e ID originales, aunque el tablero haya cambiado.</span><button disabled={busy} onClick={()=>void recoverMutation()}>Recuperar resultado</button></div>}
      {error&&<div className="error-banner" role="alert"><AlertCircle size={18}/><span>{error}</span><button onClick={()=>void load()} disabled={busy}>Reload</button></div>}
      {board?<>
        <div className="kanban">
          {board.columns.map(c=><section key={c.id} className={"column"+(dropTarget===c.id?" drag-target":"")+(draggingColumn===c.id?" column-dragging":"")+(columnTarget?.id===c.id?" column-drop-"+columnTarget.side:"")} aria-label={c.name}
            onDragEnter={e=>previewDrop(e,c.id)} onDragOver={e=>previewDrop(e,c.id)}
            onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node)){setDropTarget("");setCardTarget(t=>t?.columnId===c.id?null:t);setColumnTarget(t=>t?.id===c.id?null:t);}}} onDrop={e=>void dropOnColumn(e,c.id)}>
            <header className="column-heading" draggable={!busy}
              onDragStart={e=>{clearCardDrag();columnDrag.current={boardId:board.id,columnId:c.id};setDraggingColumn(c.id);e.dataTransfer.setData("application/x-dot-board-column",c.id);e.dataTransfer.effectAllowed="move";}}
              onDragEnd={clearColumnDrag}>
              <button className="icon-button column-drag-handle" disabled={busy} aria-label={"Move column "+c.name} title="Drag to reorder, or click to choose a position. Use Left and Right keys to move."
                onClick={()=>openColumn(c.id)} onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();e.stopPropagation();void moveColumnByKey(c.id,e.key==="ArrowLeft"?-1:1);}}}><GripVertical size={16}/></button>
              <span className={"status-mark status-"+(c.name==="In progress"?1:c.name==="Done"?2:0)}/><h2>{c.name}</h2><span className="column-count">{c.cards.length}</span><ColumnTriggers boardId={board.id} column={c} busy={busy} mutate={mutate}/><button className="icon-button" onClick={()=>openColumn(c.id)} disabled={busy} aria-label={"Edit column "+c.name}><Pencil size={14}/></button></header>
            <div className="cards">{c.cards.map(card=><article key={card.id} data-card-id={card.id} className={"task-card"+(draggingCard===card.id?" card-dragging":"")+(cardTarget?.columnId===c.id&&cardTarget.cardId===card.id?" card-drop-"+cardTarget.side:"")} draggable={!busy}
              onDragStart={e=>{e.stopPropagation();clearColumnDrag();setCardTarget(null);dragId.current=card.id;setDraggingCard(card.id);e.dataTransfer.setData("text/plain",card.id);e.dataTransfer.effectAllowed="move";}}
              onDragEnd={clearCardDrag}>
              <div className="card-topline">{card.label&&LABELS[card.label]&&<span className="card-label" style={{background:`var(--label-${card.label}-background, ${LABELS[card.label].background})`,color:`var(--label-${card.label}-color, ${LABELS[card.label].color})`}}>{LABELS[card.label].name}</span>}<button type="button" className="icon-button quick-archive" disabled={busy} aria-label={"Archivar "+card.title} title="Archivar tarjeta" draggable={false} onPointerDown={e=>e.stopPropagation()} onDragStart={e=>{e.preventDefault();e.stopPropagation();}} onClick={e=>{e.stopPropagation();void quickArchive(card,c.id);}}><Archive size={16}/></button></div>
              <button type="button" className="card-open" aria-label={"Open card "+card.title} disabled={busy} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" onClick={()=>openCard(c.id,card)} onKeyDown={e=>{if(e.altKey&&(e.key==="ArrowUp"||e.key==="ArrowDown")){e.preventDefault();void moveCardByKey(c.id,card.id,e.key==="ArrowUp"?-1:1);}}}>
              {(card.comments?.length??0)>0&&<span className="card-comment-count">{card.comments!.length} {card.comments!.length===1?"comentario":"comentarios"}</span>}
              <span className="card-title">{card.title}</span>{card.description&&<span className="card-preview">{descriptionPlainText(card.description)}</span>}
              <CardCreatedAt createdAt={card.createdAt} compact/>
              {card.automation&&<div className="card-footer"><span className="recurring-card" aria-label={"Recurring card for "+formatTriggerDate(card.automation.scheduledAt)} title={"Created by a trigger for "+formatTriggerDate(card.automation.scheduledAt)+" at 8:00 AM"}><Repeat2 size={14}/><span>{formatTriggerShortDate(card.automation.scheduledAt)}</span></span></div>}
              </button></article>)}</div>
            {!c.cards.length&&<div className="empty-column"><span className="empty-icon"><Sparkles size={20}/></span><p>{c.name==="To do"?"Great ideas start here":"Room to make progress"}</p><small>{c.name==="To do"?"Add your first card.":"Move a card to this column."}</small></div>}
            <button className="add-card" data-add-column={c.id} onClick={()=>openCard(c.id)} disabled={busy}><Plus size={17}/> Add card</button>
          </section>)}
          <button className="add-column" onClick={()=>openColumn()} disabled={busy}><Plus size={18}/> Add column</button>
        </div><div className="board-tip">Drag cards up or down to set priorities. Drag column headers to reorder them.</div>
      </>:!loading&&!error?<div className="no-boards"><Columns3 size={36} style={{margin:"auto",color:"#8daa60"}}/><h2>A fresh space for your ideas</h2><p>Create your first board and start with a card.</p><button className="button primary" onClick={()=>openBoard()}><Plus size={18}/>Create board</button></div>:null}
    </main>
    <Dialog open={!!editor} onOpenChange={open=>{if(!open&&!busy&&!lock.current)setEditor(null);}}>
      <DialogContent className={"modal editor-modal"+(editor?.kind==="card"?" card-detail-modal":"")+(descriptionExpanded&&editor?.kind==="card"?" description-maximized":"")} showCloseButton={false} onOpenAutoFocus={e=>{e.preventDefault();requestAnimationFrame(()=>{if(editor?.kind==="card"&&descriptionExpanded)document.querySelector<HTMLElement>(".description-maximized .description-reader, .description-maximized .rich-editor")?.focus({preventScroll:true});else editorInitialInput.current?.focus();});}} onCloseAutoFocus={e=>{e.preventDefault();if(editorReturnFocus.current?.isConnected)editorReturnFocus.current.focus();else document.querySelector<HTMLButtonElement>(`[data-add-column="${CSS.escape(draft.columnId)}"]`)?.focus();}} onEscapeKeyDown={e=>{if(descriptionExpanded){e.preventDefault();setDescriptionExpanded(false);}}}>
        <div className={"editor-heading"+(editor?.kind==="card"&&draft.title.length>80?" long-ticket-heading":"")}><DialogTitle className="modal-title">{editor?.kind==="card"&&editor.cardId?(draft.title||"Ticket sin título"):editorTitle}</DialogTitle><div className="editor-heading-actions">{isEditing&&editor?.kind==="card"&&<button type="button" className="button primary archive-card-action" disabled={busy||draft.description.length>5000} onClick={()=>void archiveCard()}><Archive size={17}/>Archive</button>}<DialogClose asChild><button className="icon-button" aria-label="Close" disabled={busy}><X size={20}/></button></DialogClose></div></div>
        <div className="editor-scroll" tabIndex={0} role="region" aria-label={editor?.kind==="card"?"Contenido del ticket":"Configuración del proyecto"}>
        <DialogDescription className="modal-desc">{editor?.kind==="board"?"Each board starts with three columns you can customize.":editor?.kind==="column"?"Give this stage of your board a name.":"Add the details and choose where to save your card."}</DialogDescription>
        {commentCard&&<CardCreatedAt createdAt={commentCard.createdAt}/>}
        <form id="workspace-editor" onSubmit={submit} aria-busy={busy}><fieldset disabled={busy} className="editor-fields">
          {editor?.kind!=="card"?<label className="field">Name<input ref={editorInitialInput} autoFocus required maxLength={120} placeholder={editor?.kind==="board"?"For example, Personal project":"For example, In review"} value={draft.name} onChange={e=>patchDraft({name:e.target.value})}/></label>:<label className="field">Title<input ref={editorInitialInput} autoFocus required maxLength={200} placeholder="What would you like to do?" value={draft.title} onChange={e=>patchDraft({title:e.target.value})}/></label>}
          {editor?.kind==="column"&&editor.columnId&&<label className="field">Position on board<select value={draft.position} onChange={e=>patchDraft({position:Number(e.target.value)})}>{workspace.boards.find(b=>b.id===editor.boardId)?.columns.map((c,i)=><option key={c.id} value={i}>{i+1} · {c.name}</option>)}</select></label>}
          {editor?.kind==='board'&&<label className="field">Description <span style={{fontWeight:400,color:'#8a949e'}}>(optional)</span><textarea maxLength={5000} placeholder="What will you use this board for?" value={draft.description} onChange={e=>patchDraft({description:e.target.value})}/></label>}
          {editor?.kind==='card'&&<DescriptionEditor key={`${editor.cardId??'new-card'}:${editorSession}`} value={draft.description} onChange={description=>patchDraft({description})} disabled={busy} expanded={descriptionExpanded} onExpand={()=>setDescriptionExpanded(value=>!value)} existing={!!editor.cardId}/>}
          {editor?.kind==="board"&&<div className="field">Board color<div className="color-options">{BOARD_COLORS.map((color,i)=><button type="button" key={color} className={"color-option"+(draft.color===color?" selected":"")} style={{background:color}} onClick={()=>patchDraft({color})} aria-label={["Green","Blue","Purple","Orange","Pink","Teal"][i]} aria-pressed={draft.color===color}/>)}</div></div>}
          {editor?.kind==="board"&&<div className="project-preference"><label className="project-preference-label"><input type="checkbox" aria-label="Abrir tickets con descripción ampliada" aria-describedby="project-preference-note" checked={editor.boardId?expandsDescriptionOnOpen(editingBoard):draft.expandDescriptionOnOpen} disabled={busy} onChange={e=>{if(editor.boardId)void setDescriptionPreference(editor.boardId,e.target.checked,expandsDescriptionOnOpen(editingBoard));else patchDraft({expandDescriptionOnOpen:e.target.checked});}}/><span><strong>Abrir tickets con descripción ampliada</strong><small id="project-preference-note">Se aplica a todas las tarjetas de este proyecto. {editor.boardId?"Se guarda al cambiar.":"Activada inicialmente."}</small></span></label></div>}
          {editor?.kind==="card"&&<>
            <div className="form-row"><label className="field">Board<select value={draft.boardId} onChange={e=>{const b=workspace.boards.find(b=>b.id===e.target.value);patchDraft({boardId:e.target.value,columnId:b?.columns[0].id??""});}}>{workspace.boards.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label className="field">Column<select value={draft.columnId} onChange={e=>patchDraft({columnId:e.target.value})}>{selectedTarget?.columns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
            <label className="field">Label<select value={draft.label} onChange={e=>patchDraft({label:e.target.value})}><option value="">No label</option>{Object.entries(LABELS).map(([key,label])=><option key={key} value={key}>{label.name}</option>)}</select></label>
          </>}
          {formError&&<div className="inline-error" role="alert">{formError}</div>}
        </fieldset></form>
        {commentCard&&<CardComments key={commentCard.id} card={commentCard} busy={busy} mutate={mutate} fullHeight/>}
        </div>
          <div className="form-actions editor-footer">
            {isEditing&&<div className="editor-card-actions"><button type="button" className={"button "+(editor?.kind==="card"?"delete-card-action":"danger")} disabled={busy} onClick={()=>{
              if(editor?.kind==="card"&&editor.cardId)setConfirmation({title:"Delete card?",description:"This card will be removed from the board. Archive it instead to retain it indefinitely in this private board. A pre-change snapshot is also saved privately.",operation:{action:"delete-card",cardId:editor.cardId}});
              else if(editor?.kind==="board"&&editor.boardId)setConfirmation({title:"Delete board?",description:"This board, its columns, and all its cards will be deleted.",operation:{action:"delete-board",boardId:editor.boardId}});
              else if(editor?.kind==="column"&&editor.columnId)setConfirmation({title:"Delete column?",description:"The column must be empty. The board needs at least one column.",operation:{action:"delete-column",boardId:editor.boardId,columnId:editor.columnId}});
            }}><Trash2 size={16}/><span>Delete</span></button></div>}
            <button className="button secondary" type="button" onClick={()=>{if(!lock.current)setEditor(null);}} disabled={busy}>Cancel</button><button className="button primary" type="submit" form="workspace-editor" disabled={busy||draft.description.length>5000}>{busy?<><Loader2 size={16} className="animate-spin"/>Saving…</>:isEditing?"Save changes":editor?.kind==="board"?"Create board":editor?.kind==="column"?"Add column":"Create card"}</button>
          </div>

      </DialogContent>
    </Dialog>
    <Dialog open={!!confirmation} onOpenChange={open=>{if(!open&&!busy)setConfirmation(null);}}>
      <DialogContent className="modal" role="alertdialog" showCloseButton={false} onOpenAutoFocus={e=>{e.preventDefault();deleteCancelRef.current?.focus();}}><DialogTitle className="modal-title">{confirmation?.title}</DialogTitle><DialogDescription className="modal-desc">{confirmation?.description}</DialogDescription>
        {formError&&<div className="inline-error" role="alert">{formError}</div>}
        <div className="form-actions"><button ref={deleteCancelRef} type="button" className="button secondary" onClick={()=>setConfirmation(null)} disabled={busy}>Cancel</button><button type="button" className="button danger" style={{marginRight:0}} onClick={()=>void confirmDelete()} disabled={busy}>{busy?"Deleting…":confirmation?.operation.action==="delete-card"?"Delete permanently":"Yes, delete"}</button></div>
      </DialogContent>
    </Dialog>
    {instructionsBoard&&<ProjectInstructions key={instructionsBoard.id} board={instructionsBoard} busy={busy} onClose={()=>{setInstructionsBoardId(null);setInstructionsBoardSnapshot(null);}} returnFocus={instructionsReturnFocus.current} refreshWorkspace={refreshInstructionsWorkspace} save={async operation=>{await mutate(operation);return stateRef.current.boards.find(b=>b.id===operation.boardId)?.instructions??null;}}/>}
    <ArchiveUndo entries={undoArchives} busy={busy} onUndo={entry=>void undoArchive(entry)} onDismiss={dismissUndo}/>
  </div>;
}
