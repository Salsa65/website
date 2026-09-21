begin;

alter table public.collaboration_invites alter column email drop not null;
alter table public.collaboration_invites add column if not exists accepted_at timestamptz;
alter table public.collaboration_invites add column if not exists accepted_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.collaboration_invites'::regclass
      and contype='u'
      and pg_get_constraintdef(oid) ilike '%(token)%'
  ) then
    alter table public.collaboration_invites
      add constraint collaboration_invites_token_key unique(token);
  end if;
end $$;

create or replace function private.preview_collaboration_invite_impl(p_token uuid)
returns table(project_title text, invite_role text, email_restricted boolean, expires_at timestamptz)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select p.title, i.role, nullif(btrim(i.email),'') is not null, i.expires_at
  from public.collaboration_invites i
  join public.projects p on p.id=i.project_id
  where i.token=p_token
    and i.status='pending'
    and i.expires_at>now()
  limit 1
$$;
revoke all on function private.preview_collaboration_invite_impl(uuid) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.preview_collaboration_invite_impl(uuid) to anon, authenticated;

create or replace function public.preview_collaboration_invite(p_token uuid)
returns table(project_title text, invite_role text, email_restricted boolean, expires_at timestamptz)
language sql
stable
security invoker
set search_path=private,pg_temp
as $$
  select * from private.preview_collaboration_invite_impl(p_token)
$$;
revoke all on function public.preview_collaboration_invite(uuid) from public;
grant execute on function public.preview_collaboration_invite(uuid) to anon, authenticated;

create or replace function private.accept_collaboration_invite_impl(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path=public,auth,pg_temp
as $$
declare
  inv public.collaboration_invites%rowtype;
  requester uuid := (select auth.uid());
  requester_email text := lower(coalesce(((select auth.jwt())->>'email'),''));
begin
  if requester is null then
    raise exception 'Authentication required';
  end if;

  select * into inv
  from public.collaboration_invites
  where token=p_token
    and status='pending'
    and expires_at>now()
  for update;

  if inv.id is null then
    raise exception 'Invite is invalid, expired, revoked, or already used';
  end if;

  if nullif(btrim(inv.email),'') is not null
     and lower(inv.email) <> requester_email then
    raise exception 'This invite is restricted to another email address';
  end if;

  insert into public.project_members(project_id,user_id,role)
  values(inv.project_id,requester,inv.role)
  on conflict(project_id,user_id) do update
    set role = case
      when public.project_members.role='owner' then 'owner'
      when public.project_members.role='editor' or excluded.role='editor' then 'editor'
      else 'viewer'
    end;

  update public.collaboration_invites
  set status='accepted', accepted_at=now(), accepted_by=requester
  where id=inv.id;

  return inv.project_id;
end;
$$;
revoke all on function private.accept_collaboration_invite_impl(uuid) from public, anon;
grant execute on function private.accept_collaboration_invite_impl(uuid) to authenticated;

create or replace function public.accept_collaboration_invite(p_token uuid)
returns uuid
language sql
volatile
security invoker
set search_path=private,pg_temp
as $$
  select private.accept_collaboration_invite_impl(p_token)
$$;
revoke all on function public.accept_collaboration_invite(uuid) from public, anon;
grant execute on function public.accept_collaboration_invite(uuid) to authenticated;

drop policy if exists "invites owner read" on public.collaboration_invites;
drop policy if exists "invites owner write" on public.collaboration_invites;
drop policy if exists collaboration_invites_read on public.collaboration_invites;
drop policy if exists collaboration_invites_insert on public.collaboration_invites;
drop policy if exists collaboration_invites_update on public.collaboration_invites;
drop policy if exists collaboration_invites_delete on public.collaboration_invites;

create policy collaboration_invites_read
on public.collaboration_invites for select to authenticated
using (private.project_role(project_id) in ('owner','editor'));

create policy collaboration_invites_insert
on public.collaboration_invites for insert to authenticated
with check (
  created_by=(select auth.uid())
  and (private.project_role(project_id) in ('owner','editor'))
);

create policy collaboration_invites_update
on public.collaboration_invites for update to authenticated
using (private.project_role(project_id)='owner')
with check (private.project_role(project_id)='owner');

create policy collaboration_invites_delete
on public.collaboration_invites for delete to authenticated
using (private.project_role(project_id)='owner');

grant select,insert,update,delete on public.collaboration_invites to authenticated;

create index if not exists idx_collaboration_invites_project on public.collaboration_invites(project_id);
create index if not exists idx_collaboration_invites_created_by on public.collaboration_invites(created_by);
create index if not exists idx_collaboration_invites_accepted_by on public.collaboration_invites(accepted_by);


create or replace function private.is_reforge_member()
returns boolean
language sql
stable
security definer
set search_path=public,auth,pg_temp
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1 from public.project_members pm
      where pm.user_id=(select auth.uid())
    )
    or not exists (select 1 from public.projects)
  )
$$;
revoke all on function private.is_reforge_member() from public,anon;
grant execute on function private.is_reforge_member() to authenticated;

create or replace function private.can_bootstrap_reforge_impl()
returns boolean
language sql
stable
security definer
set search_path=public,auth,pg_temp
as $$
  select (select auth.uid()) is not null
    and not exists (select 1 from public.projects)
$$;
revoke all on function private.can_bootstrap_reforge_impl() from public,anon;
grant execute on function private.can_bootstrap_reforge_impl() to authenticated;

create or replace function public.can_bootstrap_reforge()
returns boolean
language sql
stable
security invoker
set search_path=private,pg_temp
as $$
  select private.can_bootstrap_reforge_impl()
$$;
revoke all on function public.can_bootstrap_reforge() from public,anon;
grant execute on function public.can_bootstrap_reforge() to authenticated;

drop policy if exists projects_insert_owner on public.projects;
create policy projects_insert_owner
on public.projects for insert to authenticated
with check (
  owner_id=(select auth.uid())
  and private.is_reforge_member()
);

commit;

