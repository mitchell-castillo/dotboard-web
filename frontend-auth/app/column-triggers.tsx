
import {useState, useRef, useEffect, type FormEvent} from "react";
import {Zap, Plus, Pencil, Pause, Play, Trash2, Clock3, X, Loader2} from "lucide-react";
import {Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose} from "@/components/ui/dialog";
import {LABELS, type Column, type ColumnTrigger, type TriggerSchedule} from "@/lib/board-types";
import {ALL_DAYS, WEEKDAYS, TRIGGER_TIME_LABEL, scheduleSummary, formatTriggerDate} from "@/lib/column-triggers";
import type {Action} from "@/lib/workspace-store";

type ScheduleKind = "daily" | TriggerSchedule["kind"];
type Draft = {title:string;description:string;label:string;kind:ScheduleKind;weekdays:number[];day:number;enabled:boolean};
const blank:Draft={title:"",description:"",label:"",kind:"weekly",weekdays:[5],day:17,enabled:true};
const DAY_ORDER=[1,2,3,4,5,6,0];

export default function ColumnTriggers({boardId,column,busy,mutate}:{boardId:string;column:Column;busy:boolean;mutate:(action:Action)=>Promise<unknown>}){
  const [open,setOpen]=useState(false);
  const [mode,setMode]=useState<"list"|"edit"|"delete">("list");
  const [editingId,setEditingId]=useState("");
  const [deleting,setDeleting]=useState<ColumnTrigger|null>(null);
  const [draft,setDraft]=useState<Draft>(blank);
  const [error,setError]=useState("");
  const contentRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(open)contentRef.current?.scrollTo({top:0});},[open,mode,editingId]);
  const triggers=column.triggers??[];
  const activeCount=triggers.filter(t=>t.enabled).length;
  function openList(){setMode("list");setError("");setOpen(true);}
  function edit(trigger?:ColumnTrigger){
    setEditingId(trigger?.id??"");setError("");
    setDraft(trigger?{title:trigger.title,description:trigger.description,label:trigger.label,kind:trigger.schedule.kind==="weekly"&&trigger.schedule.weekdays.length===7?"daily":trigger.schedule.kind,weekdays:trigger.schedule.kind==="weekly"?[...trigger.schedule.weekdays]:[5],day:trigger.schedule.kind==="monthly-day"?trigger.schedule.day:17,enabled:trigger.enabled}:{...blank,weekdays:[5]});
    setMode("edit");
  }
  function patch(fields:Partial<Draft>){setDraft(d=>({...d,...fields}));}
  function schedule():TriggerSchedule {
    if(draft.kind==="daily")return {kind:"weekly",weekdays:[...ALL_DAYS]};
    if(draft.kind==="weekly")return {kind:"weekly",weekdays:[...draft.weekdays].sort((a,b)=>a-b)};
    if(draft.kind==="monthly-day")return {kind:"monthly-day",day:draft.day};
    return {kind:draft.kind};
  }
  async function save(e:FormEvent){
    e.preventDefault();if(busy)return;
    if(draft.kind==="weekly"&&!draft.weekdays.length){setError("Choose at least one day.");return;}
    const fields={boardId,columnId:column.id,title:draft.title,description:draft.description,label:draft.label as ""|"idea"|"task"|"urgent",schedule:schedule(),enabled:draft.enabled};
    try{await mutate(editingId?{action:"update-trigger",triggerId:editingId,...fields}:{action:"create-trigger",...fields});setMode("list");setError("");}
    catch(e){setError(e instanceof Error?e.message:"We couldn't save this trigger.");}
  }
  async function toggle(trigger:ColumnTrigger){
    setError("");
    try{await mutate({action:"toggle-trigger",boardId,columnId:column.id,triggerId:trigger.id,enabled:!trigger.enabled});}
    catch(e){setError(e instanceof Error?e.message:"We couldn't update this trigger.");}
  }
  async function remove(){
    if(!deleting||busy)return;
    try{await mutate({action:"delete-trigger",boardId,columnId:column.id,triggerId:deleting.id});setDeleting(null);setMode("list");setError("");}
    catch(e){setError(e instanceof Error?e.message:"We couldn't delete this trigger.");}
  }
  return <>
    <button className={"icon-button column-trigger-button"+(activeCount?" has-triggers":"")} disabled={busy} onClick={openList} aria-label={"Triggers for "+column.name} title={triggers.length?`${activeCount} active trigger${activeCount===1?"":"s"} · Manage triggers`:"Add recurring card triggers"}>
      <Zap size={14}/>{activeCount>0&&<span className="trigger-indicator"/>}
    </button>
    <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}>
      <DialogContent ref={contentRef} className="modal triggers-modal" showCloseButton={false} onDragStart={e=>e.stopPropagation()} onDragOver={e=>e.stopPropagation()} onDrop={e=>e.stopPropagation()}>
        <div className="trigger-dialog-heading"><DialogTitle className="modal-title">{mode==="list"?"Column triggers":mode==="delete"?"Delete trigger?":editingId?"Edit trigger":"New trigger"}</DialogTitle><DialogClose asChild><button className="icon-button" aria-label="Close triggers" disabled={busy}><X size={20}/></button></DialogClose></div>
        <DialogDescription className="modal-desc">{mode==="list"?`Create recurring cards in ${column.name}.`:mode==="delete"?"Future runs will stop. Cards already created will stay on your board.":`Choose the card to create in ${column.name} and when it repeats.`}</DialogDescription>
        {mode!=="delete"&&<div className="trigger-time"><Clock3 size={16}/><span>{TRIGGER_TIME_LABEL}</span></div>}
        {mode==="list"?<>
          <button className="button primary" disabled={busy||triggers.length>=20} onClick={()=>edit()}><Plus size={17}/>New trigger</button>
          {triggers.length?<div className="trigger-list">{triggers.map(trigger=><div key={trigger.id} className={"trigger-item"+(!trigger.enabled?" trigger-paused":"")}>
            <div className="trigger-item-heading"><strong>{trigger.title}</strong><span className={"trigger-state"+(trigger.enabled?" active":"")}>{trigger.enabled?"Active":"Paused"}</span></div>
            <p>{scheduleSummary(trigger.schedule)}</p>
            {trigger.enabled&&<small className="trigger-next">Next: {formatTriggerDate(trigger.nextRunAt)} at 8:00 AM</small>}
            {trigger.error&&<p className="trigger-error" role="alert">{trigger.error}</p>}
            <div className="trigger-item-actions"><button type="button" disabled={busy} onClick={()=>edit(trigger)}><Pencil size={14}/>Edit</button><button type="button" disabled={busy} onClick={()=>void toggle(trigger)}>{trigger.enabled?<Pause size={14}/>:<Play size={14}/>} {trigger.enabled?"Pause":"Resume"}</button><button type="button" className="trigger-delete" disabled={busy} onClick={()=>{setDeleting(trigger);setMode("delete");setError("");}} aria-label={"Delete trigger "+trigger.title}><Trash2 size={14}/>Delete</button></div>
          </div>)}</div>:<div className="triggers-empty"><Zap size={26}/><strong>A card for every routine</strong><p>Add a trigger for weekly tasks or monthly reminders.</p></div>}
          <p className="trigger-footnote">The local server checks triggers once a minute while running. Due dates catch up after it restarts. Each date creates one card; archives never expire.</p>
          {error&&<div className="inline-error" role="alert">{error}</div>}
        </>:mode==="edit"?<form onSubmit={save}>
          <label className="field">Card title<input autoFocus required maxLength={200} placeholder="For example, Register Planisware" value={draft.title} onChange={e=>patch({title:e.target.value})}/></label>
          <label className="field">Repeat<select value={draft.kind} onChange={e=>patch({kind:e.target.value as ScheduleKind})}><option value="daily">Every day</option><option value="weekly">Selected days of the week</option><option value="monthly-day">A specific day of every month</option><option value="month-end">Last day of every month</option><option value="last-working-day">Last working day of every month</option></select></label>
          {draft.kind==="weekly"&&<fieldset className="weekday-field"><legend>Days of the week</legend><div className="weekday-options">{DAY_ORDER.map(day=><button key={day} type="button" aria-label={WEEKDAYS[day]} aria-pressed={draft.weekdays.includes(day)} className={draft.weekdays.includes(day)?"selected":""} onClick={()=>patch({weekdays:draft.weekdays.includes(day)?draft.weekdays.filter(d=>d!==day):[...draft.weekdays,day]})}>{WEEKDAYS[day].slice(0,3)}</button>)}</div><button type="button" className="weekday-shortcut" onClick={()=>patch({weekdays:[1,2,3,4,5]})}>Select Monday–Friday</button></fieldset>}
          {draft.kind==="monthly-day"&&<label className="field">Day of the month<select value={draft.day} onChange={e=>patch({day:Number(e.target.value)})}>{Array.from({length:31},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select><small className="field-hint">Months without this date are skipped.</small></label>}
          {draft.kind==="last-working-day"&&<p className="trigger-schedule-note">Working days are Monday–Friday. If the month ends on a weekend, the card is created on the preceding Friday.</p>}
          <details className="trigger-card-details"><summary>Card details <small>(optional)</small></summary><div className="trigger-detail-fields">
            <label className="field">Card description<textarea maxLength={5000} placeholder="Add the details for each recurring card…" value={draft.description} onChange={e=>patch({description:e.target.value})}/></label>
            <label className="field">Card label<select value={draft.label} onChange={e=>patch({label:e.target.value})}><option value="">No label</option>{Object.entries(LABELS).map(([key,label])=><option key={key} value={key}>{label.name}</option>)}</select></label>
          </div></details>
          <label className="trigger-enabled"><input type="checkbox" checked={draft.enabled} onChange={e=>patch({enabled:e.target.checked})}/>Trigger enabled</label>
          {error&&<div className="inline-error" role="alert">{error}</div>}
          <div className="form-actions"><button className="button secondary" type="button" disabled={busy} onClick={()=>{setMode("list");setError("");}}>Cancel</button><button className="button primary" type="submit" disabled={busy}>{busy?<><Loader2 size={16} className="animate-spin"/>Saving…</>:editingId?"Save trigger":"Create trigger"}</button></div>
        </form>:<>
          <p className="trigger-delete-title">{deleting?.title}</p>{error&&<div className="inline-error" role="alert">{error}</div>}
          <div className="form-actions"><button className="button secondary" disabled={busy} onClick={()=>setMode("list")}>Cancel</button><button className="button danger" style={{marginRight:0}} disabled={busy} onClick={()=>void remove()}>{busy?"Deleting…":"Delete trigger"}</button></div>
        </>}
      </DialogContent>
    </Dialog>
  </>;
}
