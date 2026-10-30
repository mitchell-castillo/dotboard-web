
import {useEffect,useState} from 'react';
import {Undo2,X} from 'lucide-react';
export type UndoArchive={cardId:string;archiveId:string;title:string;error?:string};
function Notice({entry,busy,onUndo,onDismiss}:{entry:UndoArchive;busy:boolean;onUndo:(entry:UndoArchive)=>void;onDismiss:()=>void}){
 const [hover,setHover]=useState(false),[focus,setFocus]=useState(false),[hidden,setHidden]=useState(false),[fading,setFading]=useState(false);
 useEffect(()=>{const visibility=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility);},[]);
 useEffect(()=>{queueMicrotask(()=>setFading(false));if(hover||focus||hidden||busy||entry.error)return;let exit:ReturnType<typeof setTimeout>|undefined;const timer=setTimeout(()=>{setFading(true);exit=setTimeout(onDismiss,200);},8000);return()=>{clearTimeout(timer);if(exit)clearTimeout(exit);};},[hover,focus,hidden,busy,entry.error,onDismiss]);
 return <div className={"archive-undo"+(fading?" fading":"")} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onFocusCapture={()=>setFocus(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setFocus(false);}}><div role="status"><strong>Tarjeta archivada</strong><span>{entry.title}</span></div>{entry.error&&<p role="alert">{entry.error}</p>}<div className="archive-undo-actions"><button type="button" className="button primary" disabled={busy} onClick={()=>onUndo(entry)}><Undo2 size={16}/>Deshacer</button><button type="button" className="icon-button" disabled={busy} onClick={onDismiss} aria-label="Cerrar aviso"><X size={16}/></button></div></div>;
}
export default function ArchiveUndo({entries,busy,onUndo,onDismiss}:{entries:UndoArchive[];busy:boolean;onUndo:(entry:UndoArchive)=>void;onDismiss:(archiveId:string)=>void}){return <div className="archive-undo-stack" aria-label="Archivos recientes">{entries.map(entry=><Notice key={entry.archiveId} entry={entry} busy={busy} onUndo={onUndo} onDismiss={()=>onDismiss(entry.archiveId)}/>)}</div>;}
