import type { Section } from './types';
export const DEFAULT_SECTION_TITLES = ['Main Ideas','Brainstorming','Outlines','Chapter Planner','Scenes','Characters','Relationships','Worldbuilding','Locations','Lore','Power Systems','Plot Development','Timeline','Continuity','Themes','Research','Rough Draft','Final Draft','Publishing Notes'];
export function slugify(value:string){return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
export function inferSection(text:string, sections:Pick<Section,'title'|'id'>[]):string|undefined{
  const t=text.toLowerCase();
  const rules:[RegExp,string[]][]=[
    [/character|protagonist|villain|hero|personality|backstory/,['Characters']],
    [/location|city|village|kingdom|forest|planet|place/,['Locations']],
    [/world|culture|society|nation|faction|economy/,['Worldbuilding']],
    [/lore|history|myth|legend|ancient|religion/,['Lore']],
    [/magic|power|ability|skill|energy|mana|system/,['Power Systems']],
    [/\b(?:plot|arc|twist|conflict|climax|ending|story beat)\b/,['Plot Development','Outlines']],
    [/theme|meaning|motif|symbol|message/,['Themes']],
    [/research|source|reference|article|fact|link/,['Research']],
    [/rough draft|draft scene|draft chapter/,['Rough Draft']],
    [/final draft|final chapter|polished chapter/,['Final Draft']],
    [/timeline|chronology|date|year|sequence/,['Timeline']],
    [/continuity|contradiction|consistency|canon/,['Continuity']],
    [/relationship|romance|friendship|rival|bond/,['Relationships']],
    [/scene|sequence|set piece/,['Scenes']],
    [/chapter plan|chapter outline|chapter idea/,['Chapter Planner','Outlines']],
    [/outline|act |beat sheet/,['Outlines']]
  ];
  for(const [rx,names] of rules){if(rx.test(t)){for(const name of names){const s=sections.find(x=>x.title===name);if(s)return s.id;}}}
  return sections.find(s=>s.title==='Brainstorming')?.id ?? sections[0]?.id;
}
export function canEdit(role?:string){return role==='owner'||role==='editor';}
export function boundedAttempt(attempts:number,maxAttempts=3){return { attempts:Math.min(attempts+1,maxAttempts), terminal:attempts+1>=maxAttempts };}
