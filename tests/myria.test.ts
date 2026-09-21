import {describe,it,expect} from 'vitest';
import {deriveLocalPlan} from '../src/lib/myria';
describe('Myria planning',()=>{
 it('targets a missing story area using evidence',()=>{const p=deriveLocalPlan({Brainstorming:2,Characters:0,Lore:1});expect(p.goal).toContain('Characters');expect(p.tasks.length).toBeGreaterThan(1);});
 it('switches to cohesion when core areas are populated',()=>{const p=deriveLocalPlan({Brainstorming:1,Characters:1,Lore:1});expect(p.goal).toBe('Review story cohesion');});
 it('keeps suggested work low risk',()=>{expect(deriveLocalPlan({Plot:0}).priority).toBe('low');});
});
