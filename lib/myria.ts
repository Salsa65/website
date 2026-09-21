import { z } from 'zod';
export const MyriaResponseSchema=z.object({
  message:z.string().min(1),
  suggestion:z.object({title:z.string(),description:z.string(),reason:z.string(),priority:z.number().min(1).max(100),tasks:z.array(z.object({description:z.string(),riskLevel:z.enum(['low','medium','high'])})).max(8)}).nullable().optional()
});
export type MyriaResponse=z.infer<typeof MyriaResponseSchema>;
export function safeMyriaResponse(value:unknown):MyriaResponse{return MyriaResponseSchema.parse(value);}
