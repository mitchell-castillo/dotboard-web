import { z } from "zod";
export const INSTRUCTIONS_MAX_BYTES = 16_384;
export const instructionSourceSchema = z.object({kind:z.enum(['user-message','document','other']),reference:z.string().trim().min(1).max(1000)}).strict();
export const markdownSchema = z.string().refine(value=>new TextEncoder().encode(value).length<=INSTRUCTIONS_MAX_BYTES,'Use no more than 16 KiB of UTF-8 text.');
export const instructionsSchema = z.object({
 revisionId:z.string().uuid(),markdown:markdownSchema,notes:markdownSchema,
 updatedAt:z.number().finite(),author:z.discriminatedUnion('kind',[z.object({kind:z.literal('user'),userId:z.string().min(1).max(100)}).strict(),z.object({kind:z.literal('dot')}).strict()]),
 requestId:z.string().uuid(),sourceRefs:z.array(instructionSourceSchema).max(20),changeSummary:z.string().max(500),
}).strict();
export type ProjectInstructions = z.infer<typeof instructionsSchema>;
