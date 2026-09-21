import { describe, expect, it } from 'vitest';
import { safeMyriaResponse } from '../lib/myria';
describe('Myria structured response',()=>{
  it('accepts a safe structured suggestion',()=>{const value=safeMyriaResponse({message:'I found a useful gap.',suggestion:{title:'Resolve timeline',description:'Align two scenes',reason:'Dates conflict',priority:70,tasks:[{description:'Compare scene dates',riskLevel:'low'}]}});expect(value.suggestion?.tasks[0].riskLevel).toBe('low')});
  it('rejects unsupported risk levels',()=>expect(()=>safeMyriaResponse({message:'x',suggestion:{title:'x',description:'x',reason:'x',priority:10,tasks:[{description:'x',riskLevel:'critical'}]}})).toThrow());
});
