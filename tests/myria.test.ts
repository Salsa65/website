import { describe, expect, it } from 'vitest';
import { boundedAttempt, MyriaTaskExecutionSchema, safeMyriaResponse } from '../lib/myria';

describe('Myria structured response',()=>{
  it('accepts a safe structured suggestion',()=>{const value=safeMyriaResponse({message:'I found a useful gap.',suggestion:{title:'Resolve timeline',description:'Align two scenes',reason:'Dates conflict',priority:70,tasks:[{description:'Compare scene dates',riskLevel:'low'}]}});expect(value.suggestion?.tasks[0].riskLevel).toBe('low')});
  it('rejects unsupported risk levels',()=>expect(()=>safeMyriaResponse({message:'x',suggestion:{title:'x',description:'x',reason:'x',priority:10,tasks:[{description:'x',riskLevel:'critical'}]}})).toThrow());
  it('validates verified task evidence',()=>expect(MyriaTaskExecutionSchema.parse({actualResult:'Compared the dates.',verification:{passed:true,evidence:['Scene A says Tuesday','Scene B says Wednesday']},reflection:'A one-day mismatch exists.',revisedTask:null}).verification.passed).toBe(true));
  it('bounds retries at three attempts',async()=>{let calls=0;const result=await boundedAttempt(async()=>{calls++;return {passed:false,value:calls}},10);expect(result.passed).toBe(false);expect(result.attempts).toBe(3);expect(calls).toBe(3)});
  it('stops retrying when verification passes',async()=>{const result=await boundedAttempt(async attempt=>({passed:attempt===2,value:attempt}),3);expect(result.passed).toBe(true);expect(result.attempts).toBe(2);expect(result.value).toBe(2)});
});
