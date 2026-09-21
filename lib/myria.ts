import { z } from 'zod';

export const MyriaResponseSchema=z.object({
  message:z.string().min(1),
  suggestion:z.object({
    title:z.string(),
    description:z.string(),
    reason:z.string(),
    priority:z.number().min(1).max(100),
    tasks:z.array(z.object({description:z.string(),riskLevel:z.enum(['low','medium','high'])})).max(8)
  }).nullable().optional()
});
export type MyriaResponse=z.infer<typeof MyriaResponseSchema>;
export function safeMyriaResponse(value:unknown):MyriaResponse{return MyriaResponseSchema.parse(value);}

export const MyriaTaskExecutionSchema=z.object({
  actualResult:z.string().min(1),
  verification:z.object({passed:z.boolean(),evidence:z.array(z.string()).max(8)}),
  reflection:z.string().min(1),
  revisedTask:z.string().min(1).nullable()
});
export type MyriaTaskExecution=z.infer<typeof MyriaTaskExecutionSchema>;

export async function boundedAttempt<T>(runner:(attempt:number)=>Promise<{passed:boolean;value:T}>,maxAttempts=3){
  const limit=Math.max(1,Math.min(3,maxAttempts));
  let last:T|undefined;
  for(let attempt=1;attempt<=limit;attempt++){
    const result=await runner(attempt);last=result.value;
    if(result.passed)return {passed:true,attempts:attempt,value:result.value};
  }
  return {passed:false,attempts:limit,value:last};
}
