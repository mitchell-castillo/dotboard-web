import type { ProjectInstructions } from './project-instructions';
export type TriggerSchedule =
  | { kind: "weekly"; weekdays: number[] }
  | { kind: "monthly-day"; day: number }
  | { kind: "month-end" }
  | { kind: "last-working-day" };
export type ColumnTrigger = {
  id: string; title: string; description: string; label: string;
  schedule: TriggerSchedule; enabled: boolean; createdAt: number;
  nextRunAt: number; lastRunAt?: number; error?: string;
};
export type CommentAuthor = {kind:'user';userId:string}|{kind:'dot'};
export type CardComment = {id:string;requestId:string;body:string;createdAt:number;author:CommentAuthor};
export type Card = { id: string; title: string; description: string; label: string; createdAt?: number; updatedAt: number; comments?:CardComment[]; automation?: {triggerId: string; scheduledAt: number} };
export type Column = { id: string; name: string; cards: Card[]; triggers?: ColumnTrigger[] };
export type Board = { instructions?: ProjectInstructions; id: string; name: string; description: string; color: string; columns: Column[]; expandDescriptionOnOpen?:boolean };
export function expandsDescriptionOnOpen(board?:Pick<Board,'expandDescriptionOnOpen'>){return board?.expandDescriptionOnOpen!==false;}
export type ArchivedCard = {card:Card; archivedAt:number; boardId:string; boardName:string; columnId:string; columnName:string; archiveId?:string; position?:number; beforeId?:string; afterId?:string};
export type Workspace = { boards: Board[]; revision: number; archivedCards?:ArchivedCard[] };
export const BOARD_COLORS = ["#b7dd6b", "#7eb7dd", "#c59cdd", "#e9b86e", "#dd9494", "#7cc5b8"];
export const LABELS: Record<string, {name: string; background: string; color: string}> = {
  idea: {name: "Idea", background: "#eaf0fd", color: "#5d78b7"},
  task: {name: "Task", background: "#eaf2df", color: "#667f37"},
  urgent: {name: "Priority", background: "#fbeae5", color: "#b76b56"},
};
