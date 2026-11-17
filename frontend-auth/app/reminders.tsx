import {useEffect,useState} from 'react';
import './reminders.css';
import {BellOff,CalendarDays,List,ChevronLeft,ChevronRight,Search,Check,Clock} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import type {Action} from '@/lib/workspace-store';
import ReminderLocalEditor from './reminder-local-editor';
import {agenda,calendarDays,dateKey,dueAt,matches,moveMonth,rows,ruleLabel,timezone,zonedInputToInstant,type AgendaFilter,type ReminderModule,type ReminderRow} from '@/lib/reminders';

const filters:{key:AgendaFilter;label:string}[]=[{key:'today',label:'Hoy'},{key:'overdue',label:'Vencidos'},{key:'week',label:'Esta semana'},{key:'upcoming',label:'Próximos'},{key:'confirm',label:'Por confirmar'},{key:'completed',label:'Completados'},{key:'all',label:'Todos'}];
export default function Reminders({module,busy,readOnly,pending=false,mutate}:{module?:ReminderModule;busy:boolean;readOnly:boolean;pending?:boolean;mutate:(action:Action)=>Promise<unknown>}){
 const [view,setView]=useState<'agenda'|'calendar'>('agenda'),[filter,setFilter]=useState<AgendaFilter>('today'),[query,setQuery]=useState('');
 const [now,setNow]=useState(()=>Date.now()),[month,setMonth]=useState(()=>dateKey(Date.now(),'UTC').slice(0,7)),[day,setDay]=useState('');
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
 const [selected,setSelected]=useState<ReminderRow|null>(null),[snooze,setSnooze]=useState(''),[error,setError]=useState(''),[editing,setEditing]=useState(false);
 const locked=busy||pending;
 const series=module?.series??[],all=rows(series),filtered=agenda(series,view==='calendar'?'all':filter,query,now);
 const dated=filtered.filter(row=>row.occurrence.state!=='completed'&&dueAt(row.occurrence)!==null&&timezone(row.series));
 const dayRows=day?dated.filter(row=>dateKey(dueAt(row.occurrence)!,timezone(row.series)!)===day):[];
 function open(row:ReminderRow){setSelected(row);setSnooze('');setError('');setEditing(false);}
 function formatted(row:ReminderRow){const at=dueAt(row.occurrence),tz=timezone(row.series);return at===null?'Fecha por confirmar':new Intl.DateTimeFormat('es-DO',{timeZone:tz??'UTC',dateStyle:'medium',timeStyle:'short'}).format(at)+(tz?'':' UTC · zona original faltante');}
 async function change(kind:'complete'|'snooze'){
  if(!selected||locked||readOnly)return;
  try{const tz=timezone(selected.series);if(kind==='snooze'&&!tz)throw Error('Confirma primero la zona horaria de origen.');
   const until=kind==='snooze'?zonedInputToInstant(snooze,tz!):null;
   if(until!==null&&until<=Date.now())throw Error('Elige una fecha futura.');
   await mutate({action:'edit-reminder-occurrence',seriesId:selected.series.id,occurrenceId:selected.occurrence.id,expectedLocalRevision:selected.occurrence.localRevision??0,change:kind,snoozedUntil:until});setSelected(null);
  }catch(e){setError(e instanceof Error?e.message:'No se pudo confirmar el cambio.');}
 }
 function list(items:ReminderRow[]){return items.length?<ul className="reminder-list">{items.map(row=><li key={row.series.id+row.occurrence.id}><button type="button" onClick={()=>open(row)}><span className={'reminder-state '+row.occurrence.state}>{row.occurrence.state==='completed'?<Check size={18}/>:<Clock size={18}/>}</span><span className="reminder-text"><strong>{row.series.local.title||row.series.sourceRecord.Message||'Recordatorio sin mensaje'}</strong><small>{ruleLabel(row.series.sourceRecord.Frequency??'')} · {row.occurrence.state==='awaiting-completion'?'Esperando completar':row.occurrence.state==='completed'?'Completado en DotBoard':row.occurrence.state==='por-confirmar'?'Por confirmar':'Pendiente'}{row.occurrence.snoozedUntil?' · Pospuesto en DotBoard':''}</small></span><time>{formatted(row)}</time></button></li>)}</ul>:<div className="reminders-empty"><CalendarDays size={34}/><strong>No hay recordatorios en esta vista</strong><p>Prueba otra fecha, filtro o búsqueda.</p></div>;}
 return <section className="reminders-module" aria-label="Recordatorios"><div className="reminders-heading"><div><p className="reminders-eyebrow">TU AGENDA PRIVADA</p><h1>Recordatorios <span>{series.length}</span></h1><p>Fechas y recurrencias de RemindMe, en un espacio propio.</p></div><div className="reminder-view-switch" aria-label="Vista"><button aria-pressed={view==='agenda'} onClick={()=>setView('agenda')}><List size={17}/>Agenda</button><button aria-pressed={view==='calendar'} onClick={()=>setView('calendar')}><CalendarDays size={17}/>Calendario</button></div></div>
 <div className="reminders-notice" role="status"><BellOff size={20}/><div><strong>Avisos apagados; RemindMe sigue enviando</strong><p>Completar o posponer aquí solo organiza DotBoard. La regla y los avisos de RemindMe siguen su curso.</p></div></div>
 <div className="reminders-toolbar"><label className="reminder-search"><Search size={18}/><input aria-label="Buscar recordatorios" placeholder="Buscar recordatorios…" value={query} onChange={e=>setQuery(e.target.value)}/></label><small>{series.filter(s=>s.sourceRecord.IsPendingCompletion===true).length} esperando completar en RemindMe</small></div>
 {view==='agenda'?<><div className="reminder-filters" aria-label="Filtros de agenda">{filters.map(f=><button key={f.key} aria-pressed={filter===f.key} onClick={()=>setFilter(f.key)}>{f.label}<span>{all.filter(row=>matches(row,f.key,now)).length}</span></button>)}</div>{list(filtered)}</>:<><div className="reminder-month"><button className="icon-button" aria-label="Mes anterior" onClick={()=>{setMonth(moveMonth(month,-1));setDay('');}}><ChevronLeft size={20}/></button><h2>{new Intl.DateTimeFormat('es',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00Z'))}</h2><button className="icon-button" aria-label="Mes siguiente" onClick={()=>{setMonth(moveMonth(month,1));setDay('');}}><ChevronRight size={20}/></button><button className="button secondary" onClick={()=>{const today=dateKey(Date.now(),'UTC');setMonth(today.slice(0,7));setDay(today);}}>Hoy</button></div><div className="reminder-calendar" aria-label="Calendario mensual">{['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=><strong key={d} className="calendar-weekday">{d}</strong>)}{calendarDays(month).map(d=>{const items=dated.filter(row=>dateKey(dueAt(row.occurrence)!,timezone(row.series)!)===d);return <button key={d} className={'calendar-day'+(d.startsWith(month)?'':' outside')+(day===d?' selected':'')} aria-label={d+', '+items.length+' ocurrencias'} aria-pressed={day===d} onClick={()=>setDay(d)}><span>{Number(d.slice(-2))}</span>{items.slice(0,2).map(row=><small key={row.series.id+row.occurrence.id}>{row.series.local.title||row.series.sourceRecord.Message||'Recordatorio'}</small>)}{items.length>2&&<small>+{items.length-2} más</small>}</button>;})}</div><p className="reminder-footnote">Solo fechas conservadas en la fuente. No se calculan nuevos envíos. {all.filter(r=>!timezone(r.series)||dueAt(r.occurrence)===null).length} ocurrencias sin fecha o zona confirmada quedan en Agenda → Por confirmar.</p>{day&&<><h2 className="reminder-day-title">{day}</h2>{list(dayRows)}</>}</>}
 <Dialog open={!!selected} onOpenChange={value=>{if(!busy&&!value)setSelected(null);}}>
 <DialogContent className="modal reminder-detail">
 <DialogTitle>{editing?'Editar recordatorio':selected?.series.local.title||selected?.series.sourceRecord.Message||'Detalle del recordatorio'}</DialogTitle>
 <DialogDescription>{editing?'Cambios locales del título y la nota.':'Gestiona este recordatorio en DotBoard. La serie original se conserva.'}</DialogDescription>
 {pending&&<p role="status" className="error-banner">El resultado está pendiente. Cierra este diálogo y usa Recuperar resultado para confirmar el envío original.</p>}
 {selected&&(editing?<ReminderLocalEditor series={selected.series} busy={busy} readOnly={readOnly||pending} mutate={mutate} onCancel={()=>setEditing(false)} onSaved={()=>setSelected(null)}/>:<>
 <button type="button" className="button secondary" disabled={locked||readOnly} onClick={()=>setEditing(true)}>Editar recordatorio</button>
 <dl>
 <dt>Título original de RemindMe</dt><dd>{selected.series.sourceRecord.Message||'No disponible'}</dd>
 <dt>Nota local de DotBoard</dt><dd>{selected.series.local.notes||'Sin nota local'}</dd>
 <dt>Fecha de esta ocurrencia</dt><dd>{formatted(selected)}</dd>
 <dt>Zona de origen</dt><dd>{timezone(selected.series)??'Por confirmar'}{!timezone(selected.series)&&selected.series.sourceRecord.IanaTimeZoneId?' · '+selected.series.sourceRecord.IanaTimeZoneId:''}</dd>
 <dt>Recurrencia original</dt><dd>{selected.series.sourceRecord.Frequency||'Faltante · por confirmar'}</dd>
 <dt>Interpretación</dt><dd>{ruleLabel(selected.series.sourceRecord.Frequency??'')}. Se conservan las fechas calculadas por RemindMe; sin cálculo local.</dd>
 <dt>Solicitud original</dt><dd>{selected.series.sourceRecord.UserRequest||'No disponible'}</dd>
 </dl>
 <details><summary>Datos originales de fechas y estado</summary><pre>{JSON.stringify(selected.series.sourceRecord,null,2)}</pre></details>
 {error&&<p role="alert" className="error-banner">{error}</p>}
 <div className="reminder-detail-actions">
 <button className="button primary" disabled={readOnly||locked||selected.occurrence.state==='completed'} onClick={()=>void change('complete')}><Check size={16}/>Completar esta ocurrencia</button>
 <label>Posponer hasta ({timezone(selected.series)??'zona por confirmar'})<input type="datetime-local" value={snooze} onChange={e=>setSnooze(e.target.value)}/></label>
 <button className="button secondary" disabled={readOnly||locked||!snooze||!timezone(selected.series)||selected.occurrence.state==='completed'} onClick={()=>void change('snooze')}>Posponer esta ocurrencia</button>
 <small>Una ocurrencia completada no cancela la serie. Posponer no cambia su frecuencia. El título y la nota locales se conservan hasta que los retires.</small>
 </div>
 </>)}
 </DialogContent></Dialog>
 </section>;
}
