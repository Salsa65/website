import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

type AccessResult =
  | { ok:true; userId:string }
  | { ok:false; status:number; error:string };

export async function requireProjectAccess(req:NextRequest,projectId:string):Promise<AccessResult>{
  const authHeader=req.headers.get('authorization')||'';
  const token=authHeader.startsWith('Bearer ')?authHeader.slice(7).trim():'';
  if(!token)return {ok:false,status:401,error:'Authentication required.'};

  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return {ok:false,status:503,error:'Private access service is not configured.'};

  const client=createClient(url,key,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{headers:{Authorization:`Bearer ${token}`}}
  });

  const {data:{user},error:userError}=await client.auth.getUser(token);
  if(userError||!user)return {ok:false,status:401,error:'Invalid or expired session.'};

  const {data:membership,error:memberError}=await client
    .from('project_members')
    .select('role')
    .eq('project_id',projectId)
    .eq('user_id',user.id)
    .maybeSingle();

  if(memberError||!membership)return {ok:false,status:403,error:'This account does not have access to the requested project.'};
  return {ok:true,userId:user.id};
}
