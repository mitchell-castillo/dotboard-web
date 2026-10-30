import type { Workspace, ArchivedCard } from "./board-types.ts";

export const ARCHIVE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS=24*60*60*1000;
const WEEK_MS=7*DAY_MS;
const LOCAL_OFFSET_MS=-4*60*60*1000;
const shortDate=new Intl.DateTimeFormat("en-US",{timeZone:"America/Santo_Domingo",month:"short",day:"numeric"});
const fullDate=new Intl.DateTimeFormat("en-US",{timeZone:"America/Santo_Domingo",month:"short",day:"numeric",year:"numeric"});
export type ArchiveWeek={start:number;label:string;dateRange:string};
export type ArchiveWeekGroup=ArchiveWeek&{entries:ArchivedCard[]};

// Santo Domingo is UTC-4 year-round. Weeks begin at local midnight on Monday.
export function archiveWeekStart(timestamp:number):number {
  const local=new Date(timestamp+LOCAL_OFFSET_MS);
  const daysSinceMonday=(local.getUTCDay()+6)%7;
  return Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()-daysSinceMonday)-LOCAL_OFFSET_MS;
}
function archiveWeek(start:number,now:number):ArchiveWeek {
  const age=(archiveWeekStart(now)-start)/WEEK_MS;
  const end=start+WEEK_MS-DAY_MS;
  const crossesYear=new Date(start+LOCAL_OFFSET_MS).getUTCFullYear()!==new Date(end+LOCAL_OFFSET_MS).getUTCFullYear();
  return {start,label:age===0?"This week":age===1?"Last week":age===2?"Two weeks ago":age>2?`${age} weeks ago`:`Week of ${shortDate.format(start)}`,dateRange:`${(crossesYear?fullDate:shortDate).format(start)} – ${fullDate.format(end)}`};
}
export function archiveWeekOptions(now=Date.now()):ArchiveWeek[] {
  const weeks:ArchiveWeek[]=[];
  for(let start=archiveWeekStart(now);start+WEEK_MS>now-ARCHIVE_RETENTION_MS;start-=WEEK_MS)weeks.push(archiveWeek(start,now));
  return weeks;
}
export function groupArchivedCardsByWeek(entries:ArchivedCard[],now=Date.now()):ArchiveWeekGroup[] {
  const groups=new Map<number,ArchiveWeekGroup>();
  for(const entry of [...entries].sort((a,b)=>b.archivedAt-a.archivedAt)){
    const start=archiveWeekStart(entry.archivedAt);
    let group=groups.get(start);
    if(!group){group={...archiveWeek(start,now),entries:[]};groups.set(start,group);}
    group.entries.push(entry);
  }
  return [...groups.values()].sort((a,b)=>b.start-a.start);
}
export function archiveExpiresAt(archivedAt:number):number {
  return archivedAt + ARCHIVE_RETENTION_MS;
}

// Remove expired content before returning or saving the workspace, not just in the UI.
export function pruneArchivedCards(workspace:Workspace,now=Date.now()):boolean {
  if(!workspace.archivedCards?.length)return false;
  const retained=workspace.archivedCards.filter(entry=>Number.isFinite(entry.archivedAt)&&archiveExpiresAt(entry.archivedAt)>now);
  if(retained.length===workspace.archivedCards.length)return false;
  workspace.archivedCards=retained;
  return true;
}
