
import {useState, type FormEvent} from "react";
import {Archive, RotateCcw, Search, X, CalendarDays} from "lucide-react";
import {Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose} from "@/components/ui/dialog";
import {LABELS, type Workspace, type ArchivedCard} from "@/lib/board-types";
import CardComments from "./card-comments";
import CardCreatedAt from "./card-created-at";
import {RichDescription} from "./rich-description";
import {groupArchivedCardsByWeek} from "@/lib/card-archive";
import type {Action} from "@/lib/workspace-store";

const dateFormat=new Intl.DateTimeFormat("en-US",{timeZone:"America/Santo_Domingo",month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});
type Destination={cardId:string;boardId:string;columnId:string};

export default function CardArchive({workspace,busy,loading,mutate,onRestore}:{workspace:Workspace;busy:boolean;loading:boolean;mutate:(operation:Action)=>Promise<unknown>;onRestore:(boardId:string)=>void}){
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState("");
  const [weekFilter,setWeekFilter]=useState("all");
  const [destination,setDestination]=useState<Destination|null>(null);
  const [error,setError]=useState("");
  const entries=workspace.archivedCards??[];
  const query=search.trim().toLowerCase();
  const [now,setNow]=useState(()=>Date.now());
  const groups=groupArchivedCardsByWeek(entries,now);
  const weeks=groups;
  const selectedWeek=weekFilter==="all"||weeks.some(week=>String(week.start)===weekFilter)?weekFilter:"all";
  const visibleGroups=groups.filter(group=>selectedWeek==="all"||String(group.start)===selectedWeek).map(group=>({...group,entries:group.entries.filter(entry=>[entry.card.title,entry.card.description,entry.boardName,entry.columnName].some(text=>text.toLowerCase().includes(query)))})).filter(group=>group.entries.length);
  const restoring=entries.find(entry=>entry.card.id===destination?.cardId);
  const targetBoard=workspace.boards.find(board=>board.id===destination?.boardId);
  function chooseDestination(entry:ArchivedCard){
    const board=workspace.boards.find(b=>b.id===entry.boardId)??workspace.boards[0];
    if(!board)return;
    const column=board.columns.find(c=>c.id===entry.columnId)??board.columns[0];
    setDestination({cardId:entry.card.id,boardId:board.id,columnId:column.id});setError("");
  }
  async function restore(e:FormEvent){
    e.preventDefault();if(!destination||!restoring||busy)return;
    try{await mutate({action:"restore-card",...destination});onRestore(destination.boardId);setDestination(null);setError("");}
    catch(e){setError(e instanceof Error?e.message:"We couldn't restore this card.");}
  }
  return <>
    <button type="button" className="icon-button archive-toggle" aria-label="Archived cards" title={"Archived cards by week"+(entries.length?` · ${entries.length}`:"")} disabled={busy||loading} onClick={()=>{setNow(Date.now());setOpen(true);setDestination(null);setSearch("");setWeekFilter("all");setError("");}}><Archive size={17}/>{entries.length>0&&<span className="archive-count" aria-hidden="true">{entries.length>99?"99+":entries.length}</span>}</button>
    <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}>
      <DialogContent className="modal archive-modal" showCloseButton={false}>
        <div className="archive-heading"><DialogTitle className="modal-title">{restoring?"Restore card":"Archived cards"}</DialogTitle><DialogClose asChild><button type="button" className="icon-button" aria-label="Close archive" disabled={busy}><X size={20}/></button></DialogClose></div>
        <DialogDescription className="modal-desc">Archived cards are kept indefinitely. Original archive dates and details are preserved; refreshing never deletes them.</DialogDescription>
        {restoring?<form onSubmit={restore}>
          <p className="archive-restore-title">{restoring.card.title}</p>
          <CardCreatedAt createdAt={restoring.card.createdAt}/>
          <div className="form-row"><label className="field">Board<select required value={destination?.boardId??""} onChange={e=>{const board=workspace.boards.find(b=>b.id===e.target.value);if(board)setDestination(current=>current?{...current,boardId:board.id,columnId:board.columns[0].id}:null);}}>{workspace.boards.map(board=><option key={board.id} value={board.id}>{board.name}</option>)}</select></label><label className="field">Column<select required value={destination?.columnId??""} onChange={e=>setDestination(current=>current?{...current,columnId:e.target.value}:null)}>{targetBoard?.columns.map(column=><option key={column.id} value={column.id}>{column.name}</option>)}</select></label></div>
          <p className="archive-hint">The card will return to the selected column with its details and label.</p>
          {error&&<div className="inline-error" role="alert">{error}</div>}
          <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>{setDestination(null);setError("");}}>Cancel</button><button type="submit" className="button primary" disabled={busy||!targetBoard}>{busy?"Restoring…":<><RotateCcw size={16}/>Restore card</>}</button></div>
        </form>:<>
          <div className="archive-filters"><label className="field archive-week-filter">Week<select value={selectedWeek} onChange={e=>setWeekFilter(e.target.value)}><option value="all">All weeks · {entries.length} {entries.length===1?"card":"cards"}</option>{weeks.map(week=>{const count=groups.find(group=>group.start===week.start)?.entries.length??0;return <option key={week.start} value={String(week.start)}>{week.label} · {week.dateRange} · {count}</option>;})}</select></label><label className="archive-search"><Search size={16}/><input type="search" aria-label="Search archived cards" placeholder="Search archived cards…" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
          <p className="archive-hint archive-week-note">Grouped by archive date · Monday–Sunday · Santo Domingo</p>
          {!workspace.boards.length&&entries.length>0&&<p className="archive-hint">Create a board before restoring a card.</p>}
          <div className="archive-weeks">{visibleGroups.map(group=><section className="archive-week" key={group.start} aria-label={group.label+" · "+group.dateRange}><header className="archive-week-heading"><CalendarDays size={17}/><div><h3>{group.label}</h3><p>{group.dateRange}</p></div><span className="archive-week-count">{group.entries.length} {group.entries.length===1?"card":"cards"}</span></header><div className="archive-list">{group.entries.map(entry=><article className="archive-item" key={entry.card.id}>
            <div className="archive-item-heading"><h3>{entry.card.title}</h3><button type="button" className="button secondary archive-restore" disabled={busy||!workspace.boards.length} aria-label={"Restore "+entry.card.title} onClick={()=>chooseDestination(entry)}><RotateCcw size={14}/>Restore</button></div>
            <p className="archive-location">{entry.boardName} / {entry.columnName}</p>
            <CardCreatedAt createdAt={entry.card.createdAt}/>
            {entry.card.label&&LABELS[entry.card.label]&&<span className="card-label" style={{background:`var(--label-${entry.card.label}-background, ${LABELS[entry.card.label].background})`,color:`var(--label-${entry.card.label}-color, ${LABELS[entry.card.label].color})`}}>{LABELS[entry.card.label].name}</span>}
            {entry.card.description&&<details className="archive-details"><summary>Card details</summary><div className="description-prose"><RichDescription value={entry.card.description}/></div></details>}
            <div className="archive-dates"><span>Archived: {dateFormat.format(entry.archivedAt)}</span><span>Retention: kept locally, no automatic expiry</span></div>
          <details className="archive-comment-panel"><summary>Comentarios ({entry.card.comments?.length??0})</summary><CardComments card={entry.card} busy={busy} mutate={mutate}/></details></article>)}</div></section>)}</div>
          {!visibleGroups.length&&<div className="archive-empty"><Archive size={28}/><strong>{query?"No matching cards":selectedWeek!=="all"?"No archived cards this week":"No archived cards"}</strong><p>{query?"Try another search or choose a different week.":selectedWeek!=="all"?"Choose another week to review your archived cards.":"Open a card and choose Archive to keep it here indefinitely."}</p></div>}
          {error&&<div className="inline-error" role="alert">{error}</div>}
        </>}
      </DialogContent>
    </Dialog>
  </>;
}
