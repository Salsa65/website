import { describe, expect, it } from 'vitest';
import { boundedAttempt, canEdit, inferSection } from '../lib/story';
import type { Section } from '../lib/types';
const sections=['Brainstorming','Outlines','Characters','Worldbuilding','Locations','Lore','Power Systems','Plot Development','Themes','Research','Rough Draft','Final Draft'].map((title,i)=>({id:String(i),project_id:'p',title,slug:'s'+i,position:i,is_system:true})) satisfies Section[];
describe('story routing',()=>{
  it('routes from body content rather than title',()=>expect(inferSection('Her protagonist backstory hides a secret sister.',sections)).toBe('2'));
  it('routes research references',()=>expect(inferSection('Research source: an article about medieval trade.',sections)).toBe('9'));
  it('falls back to brainstorming',()=>expect(inferSection('A strange blue object.',sections)).toBe('0'));
  it('enforces edit roles',()=>{expect(canEdit('owner')).toBe(true);expect(canEdit('editor')).toBe(true);expect(canEdit('viewer')).toBe(false)});
});
describe('bounded retry',()=>{it('stops at the max',()=>{expect(boundedAttempt(0,3)).toEqual({attempts:1,terminal:false});expect(boundedAttempt(2,3)).toEqual({attempts:3,terminal:true});expect(boundedAttempt(5,3)).toEqual({attempts:3,terminal:true})})});
