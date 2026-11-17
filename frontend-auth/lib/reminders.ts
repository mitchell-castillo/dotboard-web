export type ReminderOccurrence={id:string;originalDate:string|null;dueAt:number|null;state:'pending'|'awaiting-completion'|'por-confirmar'|'completed';sourceState?:number|null;snoozedUntil?:number;completedAt?:number;localRevision?:number};
export type ReminderSeries={id:string;source:{system:'RemindMe';ownerId:string;id:string};sourceRecord:Record<string,unknown>&{Message?:string;UserRequest?:string;Frequency?:string;IanaTimeZoneId?:string;Hours?:string[]};local:{title?:string;notes?:string;revision?:number};occurrences:ReminderOccurrence[];importedAt:number};
export type ReminderModule={schemaVersion:1;notificationsEnabled:false;series:ReminderSeries[]};
export type AgendaFilter='today'|'overdue'|'week'|'upcoming'|'confirm'|'completed'|'all';
export type ReminderRow={series:ReminderSeries;occurrence:ReminderOccurrence};
const zones=new Map<string,string|null>(),dayFormats=new Map<string,Intl.DateTimeFormat>();
export function timezone(series:ReminderSeries){const tz=series.sourceRecord.IanaTimeZoneId;if(!tz)return null;if(zones.has(tz))return zones.get(tz)!;try{new Intl.DateTimeFormat('en',{timeZone:tz}).format();zones.set(tz,tz);return tz;}catch{zones.set(tz,null);return null;}}
export function dateKey(at:number,tz:string){let format=dayFormats.get(tz);if(!format){format=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'});dayFormats.set(tz,format);}return format.format(at);}
export function dueAt(occurrence:ReminderOccurrence){return occurrence.snoozedUntil??occurrence.dueAt;}
export function ruleLabel(frequency:string){
 if(/^2_TIMES?_A_YEAR$/.test(frequency))return 'Dos veces al año · fechas de origen';
 if(frequency==='EVERY_6_MONTHS')return 'Cada seis meses · intervalo';
 if(/^(YEARLY|EVERY_YEAR|1_TIMES?_A_YEAR)$/.test(frequency))return 'Anual';
 if(/^\d{1,2}_[A-Z]{3}_\d{4}$/.test(frequency))return 'Fecha única';
 if(/^EVERY_(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)$/.test(frequency)||/^\d+_TIMES?_A_WEEK$/.test(frequency))return 'Semanal';
 if(frequency==='LAST_DAY_OF_EVERY_MONTH')return 'Último día del mes';
 return 'Regla de origen conservada';
}
export function rows(series:ReminderSeries[]){return series.flatMap(s=>s.occurrences.map(occurrence=>({series:s,occurrence})));}
export function matches(row:ReminderRow,filter:AgendaFilter,now:number){
 const {series,occurrence}=row,at=dueAt(occurrence),tz=timezone(series);
 if(filter==='all')return true;
 if(filter==='completed')return occurrence.state==='completed';
 if(occurrence.state==='completed')return false;
 if(filter==='confirm')return occurrence.state==='por-confirmar'||!tz||at===null;
 if(!tz||at===null)return false;
 const day=dateKey(at,tz),today=dateKey(now,tz);
 if(filter==='today')return day===today;
 if(filter==='overdue')return at<now;
 if(filter==='upcoming')return day>today;
 if(filter==='week'){
  const current=new Date(today+'T12:00:00Z');const weekday=current.getUTCDay()||7;
  const monday=new Date(current);monday.setUTCDate(current.getUTCDate()-weekday+1);
  const sunday=new Date(monday);sunday.setUTCDate(monday.getUTCDate()+6);
  return day>=monday.toISOString().slice(0,10)&&day<=sunday.toISOString().slice(0,10);
 }
 return false;
}
export function agenda(series:ReminderSeries[],filter:AgendaFilter,query:string,now:number){
 const term=query.trim().toLocaleLowerCase();
 return rows(series).filter(row=>matches(row,filter,now)&&(!term||[row.series.sourceRecord.Message,row.series.sourceRecord.UserRequest,row.series.sourceRecord.Frequency,row.series.local.title,row.series.local.notes].join(' ').toLocaleLowerCase().includes(term))).sort((a,b)=>(dueAt(a.occurrence)??Infinity)-(dueAt(b.occurrence)??Infinity)||a.series.id.localeCompare(b.series.id));
}
export function moveMonth(month:string,delta:number){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7);}
export function calendarDays(month:string){
 const [year,m]=month.split('-').map(Number),first=new Date(Date.UTC(year,m-1,1));const start=first.getUTCDate()-((first.getUTCDay()||7)-1);
 return Array.from({length:42},(_,i)=>new Date(Date.UTC(year,m-1,start+i)).toISOString().slice(0,10));
}
export function zonedInputToInstant(input:string,tz:string){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input))throw Error('Introduce una fecha y hora válidas.');
 const base=Date.parse(input+'Z');if(!Number.isFinite(base))throw Error('Fecha inválida.');
 const format=new Intl.DateTimeFormat('sv-SE',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const candidates=[];for(let offset=-14*60;offset<=14*60;offset+=15){const at=base+offset*60000;if(format.format(at).replace(' ','T')===input)candidates.push(at);}
 if(candidates.length!==1)throw Error('Hora inexistente o ambigua en esta zona. Elige otra hora.');
 return candidates[0];
}
