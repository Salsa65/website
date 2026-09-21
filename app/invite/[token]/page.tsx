import InviteJoin from '@/components/InviteJoin';

export default async function InvitePage({params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  return <InviteJoin token={token}/>;
}
