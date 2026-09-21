import { DEFAULT_SECTION_TITLES, slugify } from './story';
import type { GuestState, Note, Project, Section, MyriaGoal } from './types';
const KEY='reforge-guest-v1';
const uid=()=>crypto.randomUUID();
export function createGuestState():GuestState{
  const projectId=uid();
  const project:Project={id:projectId,title:'Untitled Story',description:'',role:'owner'};
  const sections:Section[]=DEFAULT_SECTION_TITLES.map((title,position)=>({id:uid(),project_id:projectId,title,slug:slugify(title),position,is_system:true}));
  return {projects:[project],sections,notes:[],activeProjectId:projectId,profile:{display_name:'Guest Creator',bio:''},goals:[]};
}
export function loadGuestState():GuestState{if(typeof window==='undefined')return createGuestState();try{const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw):createGuestState()}catch{return createGuestState()}}
export function saveGuestState(state:GuestState){if(typeof window!=='undefined')localStorage.setItem(KEY,JSON.stringify(state));}
export function newGuestProject(state:GuestState,title:string):GuestState{const id=uid();const p:Project={id,title,description:'',role:'owner'};const sections=DEFAULT_SECTION_TITLES.map((name,position)=>({id:uid(),project_id:id,title:name,slug:slugify(name),position,is_system:true}));return {...state,projects:[...state.projects,p],sections:[...state.sections,...sections],activeProjectId:id};}
export function upsertGuestNote(state:GuestState,note:Note):GuestState{const exists=state.notes.some(n=>n.id===note.id);return {...state,notes:exists?state.notes.map(n=>n.id===note.id?note:n):[...state.notes,note]};}
export function addGuestGoal(state:GuestState,goal:MyriaGoal):GuestState{return {...state,goals:[goal,...state.goals]};}
