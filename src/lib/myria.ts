export type MyriaPlan={observation:string;understanding:string;goal:string;tasks:string[];priority:'low'|'medium'|'high'};
export function deriveLocalPlan(sectionCounts:Record<string,number>):MyriaPlan{
  const entries=Object.entries(sectionCounts);
  const empty=entries.filter(([,n])=>n===0).map(([k])=>k);
  if(empty.length){const focus=empty[0];return {observation:`${focus} has no material yet.`,understanding:'The project has an undeveloped structural area.',goal:`Develop ${focus}`,tasks:[`Add one foundational ${focus.toLowerCase()} note`,'Connect it to an existing story element','Review for contradictions'],priority:'low'};}
  return {observation:'All core areas contain material.',understanding:'The project is ready for cross-section consistency work.',goal:'Review story cohesion',tasks:['Find unresolved contradictions','Connect character motives to plot turns','Confirm world rules support the ending'],priority:'low'};
}
