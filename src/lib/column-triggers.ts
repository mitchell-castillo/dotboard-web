import type { TriggerSchedule, Workspace, Card } from "./board-types.ts";
import { WORKSPACE_MAX_BYTES, jsonBytes } from "./workspace-limits.ts";
export { WORKSPACE_MAX_BYTES } from "./workspace-limits.ts";

export const TRIGGER_TIMEZONE = "America/Santo_Domingo";
export const TRIGGER_TIME_LABEL = "8:00 AM · Santo Domingo";
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const MAX_RUNS_PER_READ = 100;
const DAY = 86400000;
const LOCAL_OFFSET = -4 * 3600000;

function matches(schedule: TriggerSchedule, date: Date): boolean {
  const day = date.getUTCDate();
  const weekday = date.getUTCDay();
  if (schedule.kind === "weekly") return schedule.weekdays.includes(weekday);
  if (schedule.kind === "monthly-day") return day === schedule.day;
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12));
  if (schedule.kind === "month-end") return day === last.getUTCDate();
  const lastWeekday = last.getUTCDay();
  const lastWorkingDay = last.getUTCDate() - (lastWeekday === 0 ? 2 : lastWeekday === 6 ? 1 : 0);
  return day === lastWorkingDay;
}

// Santo Domingo stays at UTC-4. 08:00 local is 12:00 UTC year-round.
export function nextTriggerRun(schedule: TriggerSchedule, after: number): number {
  const local = new Date(after + LOCAL_OFFSET);
  const todayAtEight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 12);
  for (let offset = 0; offset <= 370; offset++) {
    const timestamp = todayAtEight + offset * DAY;
    if (timestamp > after && matches(schedule, new Date(timestamp))) return timestamp;
  }
  throw new Error("This trigger has no valid next date.");
}

export function scheduleSummary(schedule: TriggerSchedule): string {
  if (schedule.kind === "monthly-day") return `Day ${schedule.day} of every month`;
  if (schedule.kind === "month-end") return "Last day of every month";
  if (schedule.kind === "last-working-day") return "Last working day of every month (Mon–Fri)";
  const days = [...schedule.weekdays].sort((a, b) => a - b);
  if (days.length === 7) return "Every day";
  if (days.join(",") === "1,2,3,4,5") return "Every weekday (Mon–Fri)";
  return `Every ${days.map(day => WEEKDAYS[day]).join(", ")}`;
}

export function formatTriggerDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {timeZone: TRIGGER_TIMEZONE, weekday: "short", month: "short", day: "numeric", year: "numeric"}).format(timestamp);
}

export function formatTriggerShortDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {timeZone: TRIGGER_TIMEZONE, month: "short", day: "numeric"}).format(timestamp);
}

export function workspaceBytes(workspace: Workspace): number {
  // Count retained extension fields too. Store mutations receive the complete
  // persisted workspace, without the API's revision envelope.
  return jsonBytes(workspace);
}

// Cards and the next-run cursor are saved together by the workspace CAS update.
// Repeated reads, retries, card moves, and card deletion cannot repeat a run.
export function materializeTriggers(workspace: Workspace, now: number): {changed: boolean; created: number} {
  let changed = false;
  let created = 0;
  for (const board of workspace.boards) for (const column of board.columns) {
    for (const trigger of column.triggers ?? []) {
      if (!trigger.enabled) continue;
      while (trigger.nextRunAt <= now && created < MAX_RUNS_PER_READ) {
        const scheduledAt = trigger.nextRunAt;
        const card: Card = {
          id: crypto.randomUUID(), title: trigger.title, description: trigger.description,
          label: trigger.label, createdAt: now, updatedAt: scheduledAt, automation: {triggerId: trigger.id, scheduledAt},
        };
        // New recurring tasks are placed first so they remain visible.
        column.cards.unshift(card);
        if (workspaceBytes(workspace) > WORKSPACE_MAX_BYTES - 1000) {
          column.cards.shift();
          const message = "Your workspace is full. Free some space so this trigger can continue.";
          if (trigger.error !== message) {
            const previousError=trigger.error;
            trigger.error = message;
            if(workspaceBytes(workspace)<=WORKSPACE_MAX_BYTES)changed=true;
            else if(previousError===undefined)delete trigger.error;
            else trigger.error=previousError;
          }
          break;
        }
        trigger.lastRunAt = scheduledAt;
        trigger.nextRunAt = nextTriggerRun(trigger.schedule, scheduledAt);
        delete trigger.error;
        created++;
        changed = true;
      }
    }
  }
  return {changed, created};
}
