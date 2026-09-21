export type Section={id:string;project_id:string;title:string;slug:string;position:number;is_system:boolean};
export type Note={id:string;project_id:string;section_id:string|null;author_id?:string;title:string;body:string;category:string;position:number;updated_at?:string};
export type Project={id:string;owner_id?:string;title:string;description:string};
export type Profile={user_id:string;display_name:string;avatar_url:string|null;bio:string;role:string};
export type MyriaState='IDLE'|'LISTENING'|'THINKING'|'PLANNING'|'TALKING'|'ERROR'|'MUTED';
export type ChatMessage={id:string;role:'user'|'assistant';content:string};
export type GuestProject={id:string;title:string;description:string;sections:Section[];notes:Note[]};
