'use client';

import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type InvitePreview={project_title:string;invite_role:'editor'|'viewer';email_restricted:boolean;expires_at:string};

export default function InviteJoin({token}:{token:string}){
  const [preview,setPreview]=useState<InvitePreview|null>(null);
  const [checking,setChecking]=useState(true);
  const [tab,setTab]=useState<'signin'|'signup'>('signin');
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [displayName,setDisplayName]=useState('');
  const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [message,setMessage]=useState('');

  async function claim(){
    if(!supabase)throw new Error('Cloud access is not configured.');
    const {data,error}=await supabase.rpc('accept_collaboration_invite',{p_token:token});
    if(error)throw error;
    window.localStorage.removeItem('redbound-pending-invite');
    const base=process.env.NEXT_PUBLIC_BASE_PATH||''; window.location.replace(data?(base+'/?project='+encodeURIComponent(String(data))):(base+'/'));
  }

  useEffect(()=>{
    if(!supabase){setError('Cloud access is not configured.');setChecking(false);return;}
    void (async()=>{
      const {data,error}=await supabase.rpc('preview_collaboration_invite',{p_token:token});
      if(error||!data?.length){setError('This private invite is invalid, expired, revoked, or already used.');setChecking(false);return;}
      setPreview(data[0] as InvitePreview); window.localStorage.setItem('redbound-pending-invite',token);
      const {data:{session}}=await supabase.auth.getSession();
      if(session){try{await claim();return;}catch(err){setError(err instanceof Error?err.message:'Could not apply invite.');}}
      setChecking(false);
    })();
  },[token]);

  async function submit(e:FormEvent){e.preventDefault();setError('');setMessage('');if(!supabase)return;setBusy(true);
    try{
      if(tab==='signup'){
        const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:displayName||'Collaborator'}}}); if(error)throw error;
        if(data.session){await claim();return;} setMessage('Account created. Confirm your email if required, then sign in. This invite will be applied automatically.');
      } else { const {error}=await supabase.auth.signInWithPassword({email,password}); if(error)throw error; await claim(); }
    }catch(err){setError(err instanceof Error?err.message:'Could not join this private project.');}finally{setBusy(false);}
  }

  async function continueAsGuest(){if(!supabase||preview?.email_restricted)return;setBusy(true);setError('');
    try{const {error}=await supabase.auth.signInAnonymously({options:{data:{display_name:'Guest Collaborator'}}});if(error)throw error;await claim();}
    catch(err){setError(err instanceof Error?err.message:'Guest access is unavailable. Sign in or create an account instead.');}finally{setBusy(false);}
  }

  if(checking)return <main className="gate"><section className="gate-card"><div className="gate-mark">R</div><p className="eyebrow">PRIVATE INVITE</p><h1>VERIFYING LINK</h1><p className="gate-copy">Checking this Reforge invitation…</p></section></main>;
  return <main className="gate"><section className="gate-card"><div className="gate-mark">R</div><p className="eyebrow">PRIVATE INVITE</p><h1>{preview?.project_title??'REFORGE'}</h1>
    <p className="gate-copy">{preview?('You have been invited as '+preview.invite_role+'. Signing in or creating an account joins this project automatically—there is no approval request.'):'This invitation cannot be used.'}</p>
    {preview&&<><div className="auth-tabs"><button onClick={()=>setTab('signin')} className={tab==='signin'?'active':''}>Sign In</button><button onClick={()=>setTab('signup')} className={tab==='signup'?'active':''}>Create Account</button></div>
      <form className="auth-form" onSubmit={submit}>{tab==='signup'&&<label>Display name<input value={displayName} onChange={e=>setDisplayName(e.target.value)} autoComplete="name"/></label>}<label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label><label>Password<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={tab==='signup'?'new-password':'current-password'}/></label>{error&&<p className="form-error">{error}</p>}{message&&<p className="form-ok">{message}</p>}<button className="primary wide" disabled={busy}>{busy?'Joining…':tab==='signup'?'Create account & join':'Sign in & join'}</button></form>
      {!preview.email_restricted&&<><div className="or"><span/>or<span/></div><button className="ghost wide" disabled={busy} onClick={continueAsGuest}>Join as Guest</button></>}{preview.email_restricted&&<p className="gate-foot">This link is locked to a specific email address. Sign in or create the account using that address.</p>}</>}
    {!preview&&error&&<p className="form-error">{error}</p>}
  </section></main>;
}
