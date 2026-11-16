import {useRef,useState} from 'react';
import {apiFetch} from '@/lib/api-client';
import type {Workspace} from '@/lib/board-types';
import {parseCurrentBackup,makeImportRequest,IMPORT_MAX_BYTES} from '../current-import.mjs';
export default function CurrentImport({onImported}:{onImported:(w:Workspace)=>void}){
 const [text,setText]=useState(''),[name,setName]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[pending,setPending]=useState(false);
 const envelope=useRef<string|null>(null),lock=useRef(false),read=useRef(0);
 async function send(){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   if(!envelope.current)envelope.current=makeImportRequest(parseCurrentBackup(text),crypto.randomUUID());
   setPending(true);
   const response=await apiFetch('/api/workspace/current-import',{method:'POST',body:envelope.current});
   const data=await response.json();
   if(!response.ok){
    if([400,413,415].includes(response.status)&&['invalid_backup','invalid_request','body_too_large','json_required'].includes(data.error)){envelope.current=null;setPending(false);}
    throw Error(data.error==='workspace_exists'?'Ya existe un tablero. No se sobrescribió: recarga para revisarlo.':data.error==='destination_has_unknown_data'?'El destino contiene datos inesperados. No se importó ni eliminó nada.':data.error||'Resultado sin confirmar.');
   }
   if(!data.workspace||!Array.isArray(data.workspace.boards)||!Number.isSafeInteger(data.workspace.revision))throw Error('Respuesta incompleta. Recupera el mismo envío.');
   envelope.current=null;setPending(false);onImported(data.workspace);
  }catch(e){setError(e instanceof Error?e.message:'Resultado sin confirmar.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <main className="auth-gate"><h1>Prepara tu DotBoard</h1><p>Este espacio todavía no está inicializado. Importa el export actual del tablero viejo. Solo se acepta una inicialización; nunca reemplaza un tablero existente ni guarda versiones antiguas.</p><label>Export JSON<input type="file" accept=".json,application/json" disabled={busy||pending} onChange={async e=>{const id=++read.current;const file=e.target.files?.[0];setText('');setName('');setError('');if(!file)return;try{if(file.size>IMPORT_MAX_BYTES)throw Error('El archivo supera 1,750,000 bytes.');const next=await file.text();parseCurrentBackup(next);if(id===read.current){setText(next);setName(file.name);}}catch(err){if(id===read.current)setError(err instanceof Error?err.message:'Archivo inválido.');}}}/></label>{name&&<p>{name}</p>}{error&&<p role="alert">{error}</p>}{pending&&<p>El envío original se conserva en esta sesión. No cambies de archivo ni cierres sesión mientras su resultado sea incierto.</p>}<button disabled={busy||(!text&&!pending)} onClick={()=>void send()}>{busy?'Comprobando…':pending?'Recuperar el mismo envío':'Importar tablero actual'}</button></main>;
}
