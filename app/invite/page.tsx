'use client';

import { useEffect, useState } from 'react';
import InviteJoin from '@/components/InviteJoin';

export default function InvitePage(){
  const [token,setToken]=useState<string|null>(null);
  useEffect(()=>{setToken(new URLSearchParams(window.location.search).get('token'));},[]);
  if(token===null)return <main className="gate"><section className="gate-card"><p className="eyebrow">PRIVATE INVITE</p><h1>LOADING</h1></section></main>;
  if(!token)return <main className="gate"><section className="gate-card"><p className="eyebrow">PRIVATE INVITE</p><h1>INVALID LINK</h1><p className="gate-copy">This invite link is missing its token.</p></section></main>;
  return <InviteJoin token={token}/>;
}
