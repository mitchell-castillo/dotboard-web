import { markdownSchema, instructionSourceSchema } from "./project-instructions.ts";
import { z } from "zod";
import { BOARD_COLORS } from "./board-types.ts";


const id = z.string().min(1).max(100);
const name = z.string().trim().min(1, "Enter a name.").max(120, "Use a name with up to 120 characters.");
const description = z.string().max(5000).default("");
const cardFields = { title: z.string().trim().min(1, "Enter a title.").max(200), description, label: z.enum(["", "idea", "task", "urgent"]).default("") };
const triggerSchedule = z.discriminatedUnion("kind", [
  z.object({kind: z.literal("weekly"), weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Choose at least one day.").max(7).refine(days => new Set(days).size === days.length, "Choose each day only once.")}),
  z.object({kind: z.literal("monthly-day"), day: z.number().int().min(1).max(31)}),
  z.object({kind: z.literal("month-end")}),
  z.object({kind: z.literal("last-working-day")}),
]);
const triggerFields = {...cardFields, schedule: triggerSchedule, enabled: z.boolean()};
export const actionSchema = z.discriminatedUnion("action", [
  z.object({action:z.literal("save-project-instructions"),boardId:id,markdown:markdownSchema,notes:markdownSchema,baseRevisionId:z.string().uuid().nullable(),requestId:z.string().uuid(),sourceRefs:z.array(instructionSourceSchema).max(20),changeSummary:z.string().max(500)}).strict(),
  z.object({action:z.literal("add-comment"),cardId:id,body:z.string().trim().min(1,"Escribe un comentario.").max(5000,"Usa un máximo de 5,000 caracteres."),requestId:z.string().uuid()}).strict(),
  z.object({action:z.literal("create-board"),name,description,color:z.enum(BOARD_COLORS as [string,...string[]]),expandDescriptionOnOpen:z.boolean().optional()}),
  z.object({action:z.literal("update-board"),boardId:id,name,description,color:z.enum(BOARD_COLORS as [string,...string[]]),expected:z.object({name:z.string(),description:z.string(),color:z.string()}).optional()}),
  z.object({action:z.literal("set-board-description-preference"),boardId:id,expanded:z.boolean(),expected:z.boolean()}).strict(),
  z.object({action:z.literal("delete-board"),boardId:id}),
  z.object({action:z.literal("create-column"),boardId:id,name}),
  z.object({action:z.literal("update-column"),boardId:id,columnId:id,name,position:z.number().int().min(0).max(49).optional()}),
  z.object({action:z.literal("move-column"),boardId:id,columnId:id,position:z.number().int().min(0).max(49)}),
  z.object({action:z.literal("delete-column"),boardId:id,columnId:id}),
  z.object({action:z.literal("create-card"),boardId:id,columnId:id,...cardFields}),
  z.object({action:z.literal("update-card"),cardId:id,boardId:id,columnId:id,...cardFields,expected:z.object({boardId:id,columnId:id,title:z.string().max(200),description:z.string().max(5000),label:z.string().max(100)}).optional()}),
  z.object({action:z.literal("move-card"),cardId:id,boardId:id,columnId:id,beforeId:id.optional()}),
  z.object({action:z.literal("delete-card"),cardId:id}),
  z.object({action:z.literal("archive-card"),cardId:id,changes:z.object({boardId:id,columnId:id,...cardFields}).optional(),expected:z.object({boardId:id,columnId:id,title:z.string().max(200),description:z.string().max(5000),label:z.string().max(100)}).optional()}),
  z.object({action:z.literal("restore-card"),cardId:id,boardId:id,columnId:id}),
  z.object({action:z.literal("undo-archive"),cardId:id,archiveId:z.string().uuid()}).strict(),
  z.object({action:z.literal("create-trigger"),boardId:id,columnId:id,...triggerFields}),
  z.object({action:z.literal("update-trigger"),boardId:id,columnId:id,triggerId:id,...triggerFields}),
  z.object({action:z.literal("toggle-trigger"),boardId:id,columnId:id,triggerId:id,enabled:z.boolean()}),
  z.object({action:z.literal("delete-trigger"),boardId:id,columnId:id,triggerId:id}),
]);
export type Action = z.infer<typeof actionSchema>;
