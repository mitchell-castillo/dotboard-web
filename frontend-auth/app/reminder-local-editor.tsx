import {useRef,useState,type FormEvent} from 'react';
import {actionSchema,type Action} from '@/lib/workspace-store';
import type {ReminderSeries} from '@/lib/reminders';

export default function ReminderLocalEditor({series,busy,readOnly,mutate,onCancel,onSaved}:{series:ReminderSeries;busy:boolean;readOnly:boolean;mutate:(action:Action)=>Promise<unknown>;onCancel:()=>void;onSaved:()=>void}){
 const [title,setTitle]=useState(series.local.title??''),[notes,setNotes]=useState(series.local.notes??''),[error,setError]=useState('');
 const submitting=useRef(false);
 async function save(event:FormEvent){
  event.preventDefault();if(busy||readOnly||submitting.current)return;
  const parsed=actionSchema.safeParse({action:'update-reminder-local',seriesId:series.id,expectedLocalRevision:series.local.revision??0,title:title.trim(),notes});
  if(!parsed.success){setError(parsed.error.issues[0]?.message??'Revisa los campos.');return;}
  submitting.current=true;setError('');
  try{await mutate(parsed.data);onSaved();}catch(e){setError(e instanceof Error?e.message:'No se pudo confirmar el cambio.');}finally{submitting.current=false;}
 }
 return <form className="reminder-local-editor" onSubmit={event=>void save(event)} aria-label="Editar recordatorio" aria-busy={busy}>
  <p>El título y la nota se guardan solo en DotBoard. El mensaje original de RemindMe se conserva.</p>
  <fieldset disabled={busy||readOnly}>
   <label htmlFor="reminder-local-title">Título local</label><input id="reminder-local-title" value={title} onChange={event=>setTitle(event.target.value)} maxLength={200} placeholder={series.sourceRecord.Message||'Título original'} aria-describedby="reminder-title-help"/>
   <small id="reminder-title-help">Déjalo vacío para usar el título original.</small>
   <label htmlFor="reminder-local-notes">Nota local</label><textarea id="reminder-local-notes" value={notes} onChange={event=>setNotes(event.target.value)} maxLength={5000} rows={5} aria-describedby="reminder-note-help reminder-note-count"/>
   <small id="reminder-note-count">{notes.length.toLocaleString('es')} / 5,000 caracteres</small>
   <small id="reminder-note-help">La nota permanece en este recordatorio hasta que la retires. No crea ocurrencias ni cargos repetidos.</small>
  </fieldset>
  <p className="reminder-footnote">La frecuencia y las fechas de origen no se editan aquí. Puedes posponer una ocurrencia desde el detalle; DotBoard no calcula nuevas recurrencias ni envía avisos.</p>
  {error&&<p role="alert" className="error-banner">{error}</p>}
  <div className="reminder-editor-actions"><button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Cancelar edición</button><button type="submit" className="button primary" disabled={busy||readOnly}>Guardar cambios locales</button></div>
 </form>;
}
