import { apiRequest } from "../lib/api-client";
"use client";
import {useRef,useState,type ChangeEvent} from 'react';
import {RotateCcw,X,Upload} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogClose} from '@/components/ui/dialog';
import type {Workspace} from '@/lib/board-types';
import {BACKUP_MAX_BYTES,BACKUP_LIMIT_MESSAGE,WORKSPACE_MAX_BYTES,WORKSPACE_LIMIT_MESSAGE,jsonBytes} from '@/lib/workspace-limits';
type Backup={format:string;formatVersion:number;exportedAt?:string;workspace:Omit<Workspace,'revision'>};
export default function LocalBackups({workspace,disabled,onChange}:{workspace:Workspace;disabled:boolean;onChange:(workspace:Workspace)=>void}) {
  const [open,setOpen]=useState(false);const [backup,setBackup]=useState<Backup|null>(null);const [filename,setFilename]=useState('');const [error,setError]=useState('');const [saving,setSaving]=useState(false);const [message,setMessage]=useState('');const lock=useRef(false);const readId=useRef(0);
  async function choose(event:ChangeEvent<HTMLInputElement>){
    const currentRead=++readId.current;setError('');setBackup(null);setFilename('');const file=event.target.files?.[0];if(!file)return;
    try {if(file.size>BACKUP_MAX_BYTES)throw new Error(BACKUP_LIMIT_MESSAGE);const parsed=JSON.parse(await file.text()) as Backup;
      if(parsed.format!=='dot-board-local-backup'||parsed.formatVersion!==1||!Array.isArray(parsed.workspace?.boards))throw new Error('Choose a DotBoard JSON backup. Full work Boardly exports are not accepted.');
      if(jsonBytes(parsed.workspace)>WORKSPACE_MAX_BYTES)throw new Error(WORKSPACE_LIMIT_MESSAGE);
      if(currentRead!==readId.current)return;setBackup(parsed);setFilename(file.name);
    }catch(e){if(currentRead===readId.current)setError(e instanceof Error?e.message:'Invalid backup.');}
  }
  async function restore(){
    if(!backup||lock.current||disabled)return;lock.current=true;setSaving(true);setError('');
    try {const response=await apiRequest('/api/workspace/restore',{method:'POST',headers:{'Content-Type':'application/json','X-Dot-Board-Local':'1'},body:JSON.stringify({revision:workspace.revision,backup})});const data=await response.json() as {workspace?:Workspace;error?:string};if(data.workspace)onChange(data.workspace);if(!response.ok)throw new Error(data.error??'Restore failed.');setOpen(false);setBackup(null);setMessage('Backup restored. Previous data is saved in a private snapshot.');}
    catch(e){setError(e instanceof Error?e.message:'Restore failed.');}finally{lock.current=false;setSaving(false);}
  }
  return <div className="backup-control backup-control-compact">
    <button type="button" className="button secondary backup-download-button" disabled={disabled||saving} onClick={()=>{readId.current++;setOpen(true);setBackup(null);setFilename('');setError('');setMessage('');}}><RotateCcw size={15}/>Restore backup</button>
    {message&&<p className="backup-feedback" role="status">{message}</p>}
    <Dialog open={open} onOpenChange={value=>{if(!saving){readId.current++;setOpen(value);}}}><DialogContent className="modal" showCloseButton={false}>
      <div className="archive-heading"><DialogTitle className="modal-title">Restore backup</DialogTitle><DialogClose asChild><button className="icon-button" aria-label="Close restore backup" disabled={saving}><X size={20}/></button></DialogClose></div>
      <DialogDescription className="modal-desc">Replace this private workspace with a previous DotBoard export. A snapshot of the current workspace is saved first. Project instructions are replaced too; older backups without them remove the active documents (the previous snapshot keeps them). Your work Boardly is never contacted.</DialogDescription>
      <label className="field">Backup JSON<input type="file" accept="application/json,.json" onChange={event=>void choose(event)} disabled={saving}/></label>
      {backup&&<div className="local-backup-summary"><strong>{filename}</strong><p>{backup.workspace.boards.map(b=>b.name).join(' · ')}</p><p>{backup.workspace.boards.reduce((n,b)=>n+b.columns.reduce((sum,c)=>sum+c.cards.length,0),0)} active cards · {backup.workspace.archivedCards?.length??0} archived cards</p><p>Current revision: {workspace.revision}. Restore creates a new revision.</p></div>}
      {error&&<div className="inline-error" role="alert">{error}</div>}
      <div className="form-actions"><button className="button secondary" onClick={()=>{readId.current++;setOpen(false);}} disabled={saving}>Cancel</button><button className="button primary" onClick={()=>void restore()} disabled={!backup||disabled||saving}><Upload size={16}/>{saving?'Restoring…':'Restore these boards'}</button></div>
    </DialogContent></Dialog>
  </div>;
}
