import {apiFetch,downloadAuthenticated} from "@/lib/api-client";


import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {BookOpen,Download,FileText,History,Loader2,Pencil,Plus,RefreshCw,Trash2,X} from "lucide-react";
import {Dialog,DialogContent,DialogDescription,DialogTitle} from "@/components/ui/dialog";
import type {Board} from "@/lib/board-types";
import {INSTRUCTIONS_MAX_BYTES,type ProjectInstructions as InstructionsDocument} from "@/lib/project-instructions";
import type {Action} from "@/lib/workspace-store";

type SourceRef=InstructionsDocument["sourceRefs"][number];
type Draft=Pick<InstructionsDocument,"markdown"|"notes"|"sourceRefs"|"changeSummary">;
type HistoryEntry={workspaceRevision:number;document:InstructionsDocument|null;reason:string;createdAt:number};
type SaveAction=Extract<Action,{action:"save-project-instructions"}>;
type PendingConfirmation=
  | {kind:"close"}
  | {kind:"replace";draft:Draft;baseRevisionId:string|null}
  | {kind:"rebase";baseRevisionId:string|null};
type Props={
  board:Board;
  busy:boolean;
  onClose:()=>void;
  returnFocus:HTMLElement|null;
  refreshWorkspace:()=>Promise<void>;
  save:(operation:SaveAction)=>Promise<InstructionsDocument|null>;
};

const sourceLabels:Record<SourceRef["kind"],string>={"user-message":"Mensaje del usuario",document:"Documento",other:"Otra referencia"};
const byteLength=(value:string)=>new TextEncoder().encode(value).length;
const draftFrom=(document:InstructionsDocument|null):Draft=>({
  markdown:document?.markdown??"",
  notes:document?.notes??"",
  sourceRefs:document?.sourceRefs.map(source=>({...source}))??[],
  changeSummary:"",
});
const authorLabel=(document:InstructionsDocument)=>document.author.kind==="dot"?"dot (cuenta de servicio)":"Cuenta de usuario: "+document.author.userId;
const dateLabel=(value:number)=>Number.isFinite(new Date(value).getTime())?new Date(value).toLocaleString("es",{dateStyle:"medium",timeStyle:"short"}):"Fecha no disponible";
const dateISO=(value:number)=>Number.isFinite(new Date(value).getTime())?new Date(value).toISOString():undefined;

function DocumentBody({document,compact=false}:{document:InstructionsDocument|null;compact?:boolean}){
  if(!document)return <div className="instructions-empty"><FileText size={28}/><strong>Aún no hay instrucciones</strong><p>Este proyecto empieza sin instrucciones ni notas. Añade únicamente el contexto que quieras conservar aquí.</p></div>;
  return <div className={"instructions-document"+(compact?" instructions-document-compact":"")}>
    <div className="instructions-section-heading"><h3>Instrucciones · Markdown</h3><span>Texto literal</span></div>
    <pre className="instructions-markdown" tabIndex={0} aria-label="Instrucciones guardadas en Markdown">{document.markdown||"Sin instrucciones escritas."}</pre>
    <div className="instructions-section-heading"><h3>Notas y contexto</h3><span>No conceden permisos</span></div>
    <pre className="instructions-notes" tabIndex={0} aria-label="Notas guardadas">{document.notes||"Sin notas."}</pre>
    <details className="instructions-provenance">
      <summary>Origen y detalles de esta versión</summary>
      <dl>
        <div><dt>Última edición</dt><dd><time dateTime={dateISO(document.updatedAt)}>{dateLabel(document.updatedAt)}</time></dd></div>
        <div><dt>Autor registrado</dt><dd>{authorLabel(document)}</dd></div>
        <div><dt>Versión</dt><dd>{document.revisionId}</dd></div>
        {document.changeSummary&&<div><dt>Resumen del cambio</dt><dd>{document.changeSummary}</dd></div>}
      </dl>
      <p>La autoría identifica la cuenta que guardó el contenido, no verifica que cada instrucción esté autorizada. Las referencias son contexto editable.</p>
      {document.sourceRefs.length?<ul>{document.sourceRefs.map((source,index)=><li key={index}><strong>{sourceLabels[source.kind]}:</strong> {source.reference}</li>)}</ul>:<p>Sin referencias de origen.</p>}
    </details>
  </div>;
}

export default function ProjectInstructions({board,busy,onClose,returnFocus,refreshWorkspace,save}:Props){
  const [document,setDocument]=useState<InstructionsDocument|null>(board.instructions??null);
  const [view,setView]=useState<"read"|"edit"|"history">("read");
  const [loading,setLoading]=useState(true);
  const [ready,setReady]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [draft,setDraft]=useState<Draft|null>(null);
  const [initialDraft,setInitialDraft]=useState<Draft|null>(null);
  const [baseRevisionId,setBaseRevisionId]=useState<string|null>(null);
  const [history,setHistory]=useState<HistoryEntry[]>([]);
  const [historyLoaded,setHistoryLoaded]=useState(false);
  const [historyLoading,setHistoryLoading]=useState(false);
  const [historyError,setHistoryError]=useState("");
  const [nextBefore,setNextBefore]=useState<number|null>(null);
  const [confirmation,setConfirmation]=useState<PendingConfirmation|null>(null);
  const savingLock=useRef(false);
  const requestId=useRef<string|null>(null);
  const currentRequest=useRef<AbortController|null>(null);
  const historyRequest=useRef<AbortController|null>(null);
  const paneRef=useRef<HTMLDivElement>(null);
  const readerTabRef=useRef<HTMLButtonElement>(null);
  const markdownRef=useRef<HTMLTextAreaElement>(null);
  const keepEditingRef=useRef<HTMLButtonElement>(null);
  const dirty=!!draft&&JSON.stringify(draft)!==JSON.stringify(initialDraft);
  const stale=!!draft&&ready&&baseRevisionId!==(document?.revisionId??null);
  const markdownBytes=byteLength(draft?.markdown??"");
  const notesBytes=byteLength(draft?.notes??"");
  const invalid=markdownBytes>INSTRUCTIONS_MAX_BYTES||notesBytes>INSTRUCTIONS_MAX_BYTES||!!draft?.sourceRefs.some(source=>!source.reference.trim());
  const blocked=busy||saving;
  const endpoint="/api/workspace/instructions?boardId="+encodeURIComponent(board.id);

  const loadCurrent=useCallback(async()=>{
    currentRequest.current?.abort();
    const controller=new AbortController();
    currentRequest.current=controller;
    setLoading(true);setError("");
    try{
      await refreshWorkspace();
      if(controller.signal.aborted)return;
      const response=await apiFetch("/api/workspace/instructions?boardId="+encodeURIComponent(board.id),{cache:"no-store",signal:controller.signal});
      const data=await response.json() as {document:InstructionsDocument|null;error?:string};
      if(!response.ok)throw new Error(data.error??"No se pudieron leer las instrucciones.");
      if(controller.signal.aborted)return;
      setDocument(data.document);setReady(true);
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"No se pudieron leer las instrucciones.");}
    finally{if(!controller.signal.aborted)setLoading(false);}
  },[board.id,refreshWorkspace]);

  useEffect(()=>{
    let active=true;
    queueMicrotask(()=>{if(active)void loadCurrent();});
    return ()=>{active=false;currentRequest.current?.abort();historyRequest.current?.abort();};
  },[loadCurrent]);
  useEffect(()=>{
    if(!dirty&&!saving)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    window.addEventListener("beforeunload",warn);
    return ()=>window.removeEventListener("beforeunload",warn);
  },[dirty,saving]);
  useEffect(()=>{
    paneRef.current?.scrollTo({top:0});
    if(view==="edit")markdownRef.current?.focus({preventScroll:true});
  },[view]);

  function applyDraft(next:Draft,base:string|null){
    setDraft(next);setInitialDraft(draftFrom(document));setBaseRevisionId(base);
    requestId.current=null;setView("edit");setError("");setNotice("");
  }
  function edit(){
    if(!ready||loading||blocked)return;
    if(!draft)applyDraft(draftFrom(document),document?.revisionId??null);
    else setView("edit");
  }
  function patch(fields:Partial<Draft>){
    requestId.current=null;
    setDraft(value=>value?{...value,...fields}:value);
    setNotice("");
  }
  function close(){
    if(blocked||savingLock.current)return;
    if(dirty)setConfirmation({kind:"close"});
    else onClose();
  }
  async function loadHistory(before?:number){
    if(historyRequest.current||blocked)return;
    const controller=new AbortController();historyRequest.current=controller;
    setHistoryLoading(true);setHistoryError("");
    try{
      const response=await apiFetch("/api/workspace/instructions/history?boardId="+encodeURIComponent(board.id)+(before===undefined?"":"&before="+before),{cache:"no-store",signal:controller.signal});
      const data=await response.json() as {entries:HistoryEntry[];nextBefore:number|null;error?:string};
      if(!response.ok)throw new Error(data.error??"No se pudo cargar el historial.");
      if(controller.signal.aborted)return;
      setHistory(entries=>before===undefined?data.entries:[...entries,...data.entries]);
      setNextBefore(data.nextBefore);setHistoryLoaded(true);
      if(before===undefined&&data.entries.length){setDocument(data.entries[0].document);setReady(true);}
    }catch(e){if(!controller.signal.aborted)setHistoryError(e instanceof Error?e.message:"No se pudo cargar el historial.");}
    finally{if(!controller.signal.aborted){setHistoryLoading(false);historyRequest.current=null;}}
  }
  function showHistory(){
    setView("history");
    if(!historyLoaded)void loadHistory();
  }
  function restore(entry:HistoryEntry){
    const next={...draftFrom(entry.document),changeSummary:"Recuperar contenido de la revisión "+entry.workspaceRevision+" como nueva versión."};
    const base=document?.revisionId??null;
    if(dirty)setConfirmation({kind:"replace",draft:next,baseRevisionId:base});
    else applyDraft(next,base);
  }
  function confirm(){
    if(!confirmation||blocked||savingLock.current)return;
    const choice=confirmation;setConfirmation(null);
    if(choice.kind==="close"){onClose();return;}
    if(choice.kind==="replace"){applyDraft(choice.draft,choice.baseRevisionId);return;}
    setBaseRevisionId(choice.baseRevisionId);requestId.current=null;setError("");
    setNotice("Base actualizada por ti. El borrador se conserva; todavía no se ha guardado.");
    setView("edit");
  }
  async function submit(event:FormEvent){
    event.preventDefault();
    if(!draft||!dirty||blocked||savingLock.current||loading||invalid||stale||!ready)return;
    savingLock.current=true;setSaving(true);setError("");setNotice("");
    // A read started before this write must not replace the newly saved document.
    currentRequest.current?.abort();currentRequest.current=null;
    historyRequest.current?.abort();historyRequest.current=null;setHistoryLoading(false);
    const id=requestId.current??crypto.randomUUID();requestId.current=id;
    try{
      const saved=await save({action:"save-project-instructions",boardId:board.id,...draft,sourceRefs:draft.sourceRefs.map(source=>({...source,reference:source.reference.trim()})),baseRevisionId,requestId:id});
      setDocument(saved);setDraft(null);setInitialDraft(null);setBaseRevisionId(saved?.revisionId??null);
      requestId.current=null;setView("read");setHistoryLoaded(false);setHistory([]);setNextBefore(null);
      setNotice("Instrucciones guardadas.");
      requestAnimationFrame(()=>readerTabRef.current?.focus());
    }catch(e){
      setError((e instanceof Error?e.message:"No se pudieron guardar las instrucciones.")+" Tu borrador y su versión de base se conservan. Revisa la versión actual antes de reintentar.");
    }finally{savingLock.current=false;setSaving(false);}
  }

  return <>
    <Dialog open onOpenChange={open=>{if(!open)close();}}>
      <DialogContent className="modal instructions-modal" showCloseButton={false}
        onOpenAutoFocus={event=>{event.preventDefault();readerTabRef.current?.focus();}}
        onCloseAutoFocus={event=>{event.preventDefault();if(returnFocus?.isConnected)returnFocus.focus();}}
        onEscapeKeyDown={event=>{if(blocked||savingLock.current||confirmation)event.preventDefault();}}
        onInteractOutside={event=>{if(blocked||savingLock.current)event.preventDefault();}}>
        <div className="instructions-heading">
          <div><span className="instructions-eyebrow"><FileText size={15}/>Documento del proyecto</span><DialogTitle className="modal-title">Instrucciones · {board.name}</DialogTitle></div>
          <button type="button" className="icon-button" onClick={close} disabled={blocked} aria-label="Cerrar instrucciones"><X size={20}/></button>
        </div>
        <DialogDescription className="modal-desc instructions-description">Contexto persistente de este proyecto para ti y dot. Las notas y las referencias no conceden autorizaciones ni sustituyen tus permisos.</DialogDescription>
        <div className="instructions-toolbar">
          <div className="instructions-tabs" role="group" aria-label="Vista de las instrucciones">
            <button ref={readerTabRef} type="button" aria-pressed={view==="read"} disabled={blocked} onClick={()=>setView("read")}><BookOpen size={15}/>Leer</button>
            <button type="button" aria-pressed={view==="edit"} disabled={blocked||loading||!ready} onClick={edit}><Pencil size={15}/>{draft?"Borrador":"Editar"}</button>
            <button type="button" aria-pressed={view==="history"} disabled={blocked||loading} onClick={showHistory}><History size={15}/>Historial</button>
          </div>
          <button type="button" className="icon-button" disabled={blocked||loading||historyLoading} onClick={()=>{void loadCurrent();if(view==="history")void loadHistory();}} aria-label="Actualizar instrucciones guardadas" title="Actualizar la versión guardada, sin cambiar el borrador"><RefreshCw size={16} className={loading?"animate-spin":""}/></button>
        </div>
        <div ref={paneRef} className="instructions-scroll" tabIndex={0} role="region" aria-label={view==="history"?"Historial de instrucciones":view==="edit"?"Editor de instrucciones":"Lectura de instrucciones"} aria-busy={loading||saving}>
          {error&&<div className="inline-error instructions-error" role="alert"><p>{error}</p><button type="button" disabled={blocked||loading} onClick={()=>{setView("read");void loadCurrent();}}>Revisar versión actual</button></div>}
          {notice&&<p className="instructions-notice" role="status">{notice}</p>}
          {loading&&<p className="instructions-loading" role="status"><Loader2 size={16} className="animate-spin"/>Leyendo la versión guardada…</p>}
          {draft&&view!=="edit"&&<div className="instructions-draft-note"><span>Tu borrador sigue aquí, sin guardar.</span><button type="button" disabled={blocked} onClick={()=>setView("edit")}>Volver al borrador</button></div>}
          {stale&&<div className="instructions-conflict" role="status"><strong>Hay una versión guardada diferente.</strong><p>El borrador conserva su base original. Compara ambos textos antes de decidir qué conservar.</p><details><summary>Comparar con la versión guardada</summary><DocumentBody document={document} compact/></details><button type="button" className="button secondary" disabled={blocked||loading} onClick={()=>setConfirmation({kind:"rebase",baseRevisionId:document?.revisionId??null})}>Conservar borrador y actualizar su base</button></div>}
          {view==="read"&&<>
            {!loading&&<DocumentBody document={document}/>}
            {!document&&!loading&&ready&&<button type="button" className="button primary instructions-start" disabled={blocked} onClick={edit}><Plus size={16}/>Añadir instrucciones</button>}
          </>}
          {view==="edit"&&draft&&<form id="project-instructions-form" onSubmit={submit}>
            <fieldset disabled={blocked} className="instructions-fields">
              <label className="field" htmlFor="project-instructions-markdown">Instrucciones en Markdown
                <textarea ref={markdownRef} id="project-instructions-markdown" className="instructions-editor" value={draft.markdown} onChange={event=>patch({markdown:event.target.value})} spellCheck={false} placeholder="# Objetivo del proyecto" aria-describedby="instructions-markdown-limit" aria-invalid={markdownBytes>INSTRUCTIONS_MAX_BYTES}/>
                <small id="instructions-markdown-limit" className={"instructions-byte-count"+(markdownBytes>INSTRUCTIONS_MAX_BYTES?" invalid":"")}>{markdownBytes.toLocaleString("es")} / {INSTRUCTIONS_MAX_BYTES.toLocaleString("es")} bytes UTF-8</small>
              </label>
              <label className="field" htmlFor="project-instructions-notes">Notas y contexto de dot
                <textarea id="project-instructions-notes" value={draft.notes} onChange={event=>patch({notes:event.target.value})} placeholder="Observaciones, contexto y dudas pendientes. No equivale a una autorización." aria-describedby="instructions-notes-limit" aria-invalid={notesBytes>INSTRUCTIONS_MAX_BYTES}/>
                <small id="instructions-notes-limit" className={"instructions-byte-count"+(notesBytes>INSTRUCTIONS_MAX_BYTES?" invalid":"")}>{notesBytes.toLocaleString("es")} / {INSTRUCTIONS_MAX_BYTES.toLocaleString("es")} bytes UTF-8 · Las notas no conceden permisos.</small>
              </label>
              <details className="instructions-source-editor">
                <summary>Referencias de origen <small>(opcionales, {draft.sourceRefs.length}/20)</small></summary>
                <p>Añade la referencia o enlace del mensaje o documento original. Es contexto editable, no una verificación de autorización.</p>
                <div className="instructions-source-list">{draft.sourceRefs.map((source,index)=><div className="instructions-source-row" key={index}>
                  <label className="field">Tipo de referencia {index+1}<select value={source.kind} onChange={event=>patch({sourceRefs:draft.sourceRefs.map((value,i)=>i===index?{...value,kind:event.target.value as SourceRef["kind"]}:value)})}>{Object.entries(sourceLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
                  <label className="field">Referencia {index+1}<input maxLength={1000} required value={source.reference} placeholder="Enlace o identificador de origen" onChange={event=>patch({sourceRefs:draft.sourceRefs.map((value,i)=>i===index?{...value,reference:event.target.value}:value)})}/></label>
                  <button type="button" className="icon-button" aria-label={"Eliminar referencia "+(index+1)} onClick={()=>patch({sourceRefs:draft.sourceRefs.filter((_,i)=>i!==index)})}><Trash2 size={16}/></button>
                </div>)}</div>
                <button type="button" className="button secondary" disabled={blocked||draft.sourceRefs.length>=20} onClick={()=>patch({sourceRefs:[...draft.sourceRefs,{kind:"user-message",reference:""}]})}><Plus size={15}/>Añadir referencia</button>
              </details>
              <label className="field" htmlFor="project-instructions-summary">Resumen del cambio <span className="field-optional">(opcional)</span><input id="project-instructions-summary" value={draft.changeSummary} maxLength={500} onChange={event=>patch({changeSummary:event.target.value})} placeholder="Qué cambió y por qué"/></label>
              <p className="instructions-edit-hint">El contenido se muestra como texto literal: no ejecuta HTML ni carga imágenes o recursos externos. Guardar crea una versión de este documento, sin cambiar tarjetas ni columnas.</p>
            </fieldset>
          </form>}
          {view==="history"&&<div className="instructions-history">
            <p className="instructions-history-hint">Cargar una versión solo prepara un borrador. Debes guardarlo para crear una versión nueva; no restaura el resto del proyecto.</p>
            {history.map((entry,index)=><article className="instructions-history-entry" key={entry.workspaceRevision+":"+index}>
              <div className="instructions-history-heading"><div><strong>{index===0?"Versión guardada actual":"Revisión del espacio "+entry.workspaceRevision}</strong>{entry.document&&entry.createdAt!==0?<time dateTime={dateISO(entry.createdAt)}>{dateLabel(entry.createdAt)}</time>:<span className="instructions-history-undated">Sin versión guardada</span>}</div><button type="button" className="button secondary" disabled={blocked||loading||!ready} onClick={()=>restore(entry)}>Cargar como borrador</button></div>
              <p>{entry.document?authorLabel(entry.document):"Sin documento guardado"}</p>
              {entry.document?.changeSummary&&<p>{entry.document.changeSummary}</p>}
              <details><summary>Leer esta versión</summary><DocumentBody document={entry.document} compact/></details>
            </article>)}
            {!history.length&&historyLoaded&&!historyLoading&&<p className="instructions-history-hint">Aún no hay versiones guardadas.</p>}
            {historyError&&<div className="inline-error" role="alert">{historyError}</div>}
            {historyLoading&&<p className="instructions-loading" role="status"><Loader2 size={16} className="animate-spin"/>Cargando historial…</p>}
            {(!historyLoaded||nextBefore!==null)&&!historyLoading&&<button type="button" className="button secondary" onClick={()=>void loadHistory(historyLoaded?nextBefore??undefined:undefined)} disabled={blocked}>{historyError?"Reintentar historial":"Cargar versiones anteriores"}</button>}
          </div>}
        </div>
        <div className="instructions-footer">
          <div className="instructions-download">{document?<button type="button" className="instructions-download-link" onClick={()=>void downloadAuthenticated(endpoint+"&format=md","project-instructions.md").catch(()=>setError("No se pudo descargar el documento."))}><Download size={15}/>Descargar .md guardado</button>:<span>El .md estará disponible al guardar.</span>}<small>El .md contiene solo instrucciones. Las notas y referencias se conservan en el backup.</small></div>
          <div className="instructions-footer-actions"><button type="button" className="button secondary" disabled={blocked} onClick={close}>Cerrar</button>{view==="edit"&&<button type="submit" form="project-instructions-form" className="button primary" disabled={!dirty||blocked||loading||invalid||stale||!ready}>{saving?<><Loader2 size={16} className="animate-spin"/>Guardando…</>:"Guardar instrucciones"}</button>}</div>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={!!confirmation} onOpenChange={open=>{if(!open&&!blocked&&!savingLock.current)setConfirmation(null);}}>
      <DialogContent className="modal instructions-confirm" role="alertdialog" showCloseButton={false} onOpenAutoFocus={event=>{event.preventDefault();keepEditingRef.current?.focus();}}>
        <DialogTitle className="modal-title">{confirmation?.kind==="rebase"?"¿Actualizar la base del borrador?":confirmation?.kind==="replace"?"¿Reemplazar el borrador?":"¿Descartar los cambios sin guardar?"}</DialogTitle>
        <DialogDescription className="modal-desc">{confirmation?.kind==="rebase"?"Conservarás el texto de tu borrador, pero el próximo guardado reemplazará la versión actual que acabas de revisar. Esto todavía no guarda nada.":confirmation?.kind==="replace"?"El borrador sin guardar se reemplazará por el contenido de la versión elegida, incluidas sus notas y referencias. Después tendrás que guardarlo.":"Al cerrar se perderán los cambios de este borrador. La versión guardada no cambia."}</DialogDescription>
        <div className="form-actions"><button ref={keepEditingRef} type="button" className="button secondary" onClick={()=>setConfirmation(null)} disabled={blocked}>Seguir revisando</button><button type="button" className="button primary" onClick={confirm} disabled={blocked}>{confirmation?.kind==="rebase"?"Actualizar base":confirmation?.kind==="replace"?"Reemplazar borrador":"Descartar y cerrar"}</button></div>
      </DialogContent>
    </Dialog>
  </>;
}
