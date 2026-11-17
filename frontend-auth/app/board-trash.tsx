import {useState} from "react";
import {Trash2,RotateCcw} from "lucide-react";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import type {Workspace} from "@/lib/board-types";
import type {Action} from "@/lib/workspace-store";
const dateFormat=new Intl.DateTimeFormat("es-DO",{timeZone:"America/Santo_Domingo",dateStyle:"medium"});
export default function BoardTrash({workspace,busy,loading,readOnly,mutate,onRestore}:{workspace:Workspace;busy:boolean;loading:boolean;readOnly:boolean;mutate:(action:Action)=>Promise<unknown>;onRestore:(id:string)=>void}){
 const [open,setOpen]=useState(false),[error,setError]=useState("");
 const entries=workspace.trashedBoards??[];
 async function restore(trashId:string,boardId:string){if(busy||readOnly)return;setError("");try{await mutate({action:"restore-board",trashId});onRestore(boardId);}catch(e){setError(e instanceof Error?e.message:"No se pudo restaurar el tablero.");}}
 return <><button type="button" className="new-board-nav" disabled={loading||busy} onClick={()=>{setError("");setOpen(true);}}><Trash2 size={17}/>Papelera <span>{entries.length}</span></button>
 <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}><DialogContent className="modal board-trash-modal"><DialogTitle className="modal-title">Papelera de tableros</DialogTitle>
 <DialogDescription className="modal-desc">Los tableros conservan su contenido durante al menos 30 días. Por ahora no hay borrado definitivo automático. Al restaurar, los disparadores no recuperan ejecuciones atrasadas.</DialogDescription>
 {error&&<p role="alert" className="inline-error">{error}</p>}
 {entries.length===0?<p>La papelera está vacía.</p>:<ul className="board-trash-list">{entries.map(entry=><li key={entry.id}><div><strong>{entry.board.name}</strong><p>{entry.board.columns.reduce((sum,c)=>sum+c.cards.length,0)} tarjetas · {entry.archivedCards.length} archivadas</p><small>Movido: {dateFormat.format(entry.trashedAt)}. Conservación mínima hasta {dateFormat.format(entry.expiresAt)}.</small></div><button type="button" className="button secondary" disabled={busy||readOnly} onClick={()=>void restore(entry.id,entry.board.id)} aria-label={"Restaurar "+entry.board.name}><RotateCcw size={16}/>Restaurar</button></li>)}</ul>}
 </DialogContent></Dialog></>;
}
