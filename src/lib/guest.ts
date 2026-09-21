import type {GuestProject,Section,Note} from './types';
export const systemTitles=['Brainstorming','Outlines','Characters','Worldbuilding','Locations','Lore','Power Systems','Plot Development','Themes','Research','Rough Draft','Final Draft'];
const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
export function newGuestProject(title='Untitled Reforge'):GuestProject{
  const id=crypto.randomUUID();
  const sections:Section[]=systemTitles.map((title,position)=>({id:crypto.randomUUID(),project_id:id,title,slug:slug(title),position,is_system:true}));
  return {id,title,description:'',sections,notes:[]};
}
export function loadGuests():GuestProject[]{
  if(typeof window==='undefined')return[];
  try{const v=localStorage.getItem('reforge-guests');return v?JSON.parse(v):[];}catch{return[];}
}
export function saveGuests(projects:GuestProject[]){if(typeof window!=='undefined')localStorage.setItem('reforge-guests',JSON.stringify(projects));}
export function sortNotes(notes:Note[]){return [...notes].sort((a,b)=>a.position-b.position||a.title.localeCompare(b.title));}
