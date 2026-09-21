create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Creator',
  avatar_url text,
  background_url text,
  bio text not null default '',
  role text not null default 'user',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor','viewer')),
  primary key(project_id,user_id)
);

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  slug text not null,
  position integer not null default 0,
  is_system boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(project_id,slug)
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  section_id uuid references public.sections(id) on delete cascade,
  title text not null,
  body text not null default '',
  category text not null default 'Brainstorming',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.myria_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  goal text not null,
  title text not null default '',
  description text not null default '',
  reason text not null default '',
  priority integer not null default 50,
  status text not null default 'planned',
  reflection text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.myria_tasks (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.myria_goals(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  status text not null default 'planned',
  risk_level text not null default 'low' check (risk_level in ('low','medium','high')),
  attempts integer not null default 0,
  max_attempts integer not null default 3 check (max_attempts between 1 and 3),
  expected_result text not null default '',
  actual_result text not null default '',
  verification text not null default '',
  reflection text not null default '',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.myria_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.myria_goals(id) on delete set null,
  task_id uuid references public.myria_tasks(id) on delete set null,
  status text not null,
  reason text not null default '',
  action text not null default '',
  resources text[] not null default '{}',
  result text not null default '',
  verification text not null default '',
  reflection text not null default '',
  retry_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.myria_memory (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_key text not null,
  memory_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(project_id,user_id,memory_key)
);

create table if not exists public.myria_conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('editor','viewer')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique(project_id,email,status)
);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.sections enable row level security;
alter table public.notes enable row level security;
alter table public.myria_goals enable row level security;
alter table public.myria_tasks enable row level security;
alter table public.myria_activity enable row level security;
alter table public.myria_memory enable row level security;
alter table public.myria_conversations enable row level security;
alter table public.project_invites enable row level security;

create or replace function private.has_project_access(pid uuid, require_edit boolean default false)
returns boolean language sql stable security definer set search_path=public,auth,pg_temp as $$
  select auth.uid() is not null and exists (
    select 1 from public.project_members pm
    where pm.project_id=pid and pm.user_id=auth.uid()
      and (not require_edit or pm.role in ('owner','editor'))
  );
$$;
revoke all on function private.has_project_access(uuid,boolean) from public;
grant usage on schema private to authenticated;
grant execute on function private.has_project_access(uuid,boolean) to authenticated;

create or replace function private.is_project_owner(pid uuid)
returns boolean language sql stable security definer set search_path=public,auth,pg_temp as $$
  select auth.uid() is not null and exists(select 1 from public.projects p where p.id=pid and p.owner_id=auth.uid());
$$;
revoke all on function private.is_project_owner(uuid) from public;
grant execute on function private.is_project_owner(uuid) to authenticated;

create or replace function private.shares_project_with(target_user uuid)
returns boolean language sql stable security definer set search_path=public,auth,pg_temp as $$
  select auth.uid()=target_user or exists(
    select 1 from public.project_members a join public.project_members b on b.project_id=a.project_id
    where a.user_id=auth.uid() and b.user_id=target_user
  );
$$;
revoke all on function private.shares_project_with(uuid) from public;
grant execute on function private.shares_project_with(uuid) to authenticated;

create or replace function public.handle_new_reforge_user()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.profiles(user_id,display_name)
  values(new.id,coalesce(nullif(new.raw_user_meta_data->>'display_name',''),'Creator'))
  on conflict(user_id) do nothing;
  return new;
end; $$;
revoke all on function public.handle_new_reforge_user() from public,anon,authenticated;
drop trigger if exists on_auth_user_created_reforge on auth.users;
create trigger on_auth_user_created_reforge after insert on auth.users for each row execute function public.handle_new_reforge_user();

create or replace function public.prevent_profile_role_change()
returns trigger language plpgsql set search_path=public,auth,pg_temp as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role then raise exception 'Profile role cannot be changed by client users'; end if;
  return new;
end; $$;
revoke all on function public.prevent_profile_role_change() from public,anon,authenticated;
drop trigger if exists prevent_profile_role_change on public.profiles;
create trigger prevent_profile_role_change before update on public.profiles for each row execute function public.prevent_profile_role_change();

create or replace function public.handle_new_reforge_project()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare titles text[]:=array['Brainstorming','Outlines','Characters','Worldbuilding','Locations','Lore','Power Systems','Plot Development','Themes','Research','Rough Draft','Final Draft']; t text; pos int:=0;
begin
  insert into public.project_members(project_id,user_id,role) values(new.id,new.owner_id,'owner') on conflict do nothing;
  foreach t in array titles loop
    insert into public.sections(project_id,title,slug,position,is_system,created_by)
    values(new.id,t,lower(regexp_replace(t,'[^a-zA-Z0-9]+','-','g')),pos,true,new.owner_id)
    on conflict(project_id,slug) do nothing;
    pos:=pos+1;
  end loop;
  return new;
end; $$;
revoke all on function public.handle_new_reforge_project() from public,anon,authenticated;
drop trigger if exists on_reforge_project_created on public.projects;
create trigger on_reforge_project_created after insert on public.projects for each row execute function public.handle_new_reforge_project();

create or replace function public.accept_project_invite(invite_id uuid)
returns void language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare inv public.project_invites%rowtype; requester_email text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  requester_email:=lower(coalesce(auth.jwt()->>'email',''));
  select * into inv from public.project_invites where id=invite_id and status='pending' for update;
  if inv.id is null then raise exception 'Invite not found'; end if;
  if requester_email='' or lower(inv.email)<>requester_email then raise exception 'Invite belongs to another email'; end if;
  insert into public.project_members(project_id,user_id,role) values(inv.project_id,auth.uid(),inv.role)
  on conflict(project_id,user_id) do update set role=excluded.role;
  update public.project_invites set status='accepted',accepted_at=now() where id=invite_id;
end; $$;
revoke all on function public.accept_project_invite(uuid) from public,anon;
grant execute on function public.accept_project_invite(uuid) to authenticated;

do $$ declare r record; begin
  for r in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename in ('profiles','projects','project_members','notes','myria_goals','sections','project_invites','myria_tasks','myria_activity','myria_memory','myria_conversations') loop
    execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename);
  end loop;
end $$;

create policy profiles_select_shared on public.profiles for select to authenticated using(private.shares_project_with(user_id));
create policy profiles_update_self on public.profiles for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy projects_select_member on public.projects for select to authenticated using(private.has_project_access(id,false));
create policy projects_insert_owner on public.projects for insert to authenticated with check(auth.uid()=owner_id);
create policy projects_update_owner on public.projects for update to authenticated using(private.is_project_owner(id)) with check(auth.uid()=owner_id);
create policy projects_delete_owner on public.projects for delete to authenticated using(private.is_project_owner(id));
create policy members_select_member on public.project_members for select to authenticated using(private.has_project_access(project_id,false));
create policy members_insert_owner on public.project_members for insert to authenticated with check(private.is_project_owner(project_id));
create policy members_update_owner on public.project_members for update to authenticated using(private.is_project_owner(project_id)) with check(private.is_project_owner(project_id));
create policy members_delete_owner on public.project_members for delete to authenticated using(private.is_project_owner(project_id));
create policy sections_select_member on public.sections for select to authenticated using(private.has_project_access(project_id,false));
create policy sections_insert_editor on public.sections for insert to authenticated with check(private.has_project_access(project_id,true) and created_by=auth.uid());
create policy sections_update_editor on public.sections for update to authenticated using(private.has_project_access(project_id,true)) with check(private.has_project_access(project_id,true));
create policy sections_delete_editor on public.sections for delete to authenticated using(private.has_project_access(project_id,true) and not is_system);
create policy notes_select_member on public.notes for select to authenticated using(private.has_project_access(project_id,false));
create policy notes_insert_editor on public.notes for insert to authenticated with check(private.has_project_access(project_id,true) and author_id=auth.uid());
create policy notes_update_editor on public.notes for update to authenticated using(private.has_project_access(project_id,true)) with check(private.has_project_access(project_id,true));
create policy notes_delete_editor on public.notes for delete to authenticated using(private.has_project_access(project_id,true));
create policy invites_select_member_or_recipient on public.project_invites for select to authenticated using(private.has_project_access(project_id,true) or lower(email)=lower(coalesce(auth.jwt()->>'email','')));
create policy invites_insert_editor on public.project_invites for insert to authenticated with check(private.has_project_access(project_id,true) and invited_by=auth.uid());
create policy invites_update_owner on public.project_invites for update to authenticated using(private.is_project_owner(project_id)) with check(private.is_project_owner(project_id));
create policy invites_delete_owner on public.project_invites for delete to authenticated using(private.is_project_owner(project_id));
create policy goals_select_member on public.myria_goals for select to authenticated using((project_id is null and user_id=auth.uid()) or (project_id is not null and private.has_project_access(project_id,false)));
create policy goals_insert_self on public.myria_goals for insert to authenticated with check(user_id=auth.uid() and (project_id is null or private.has_project_access(project_id,true)));
create policy goals_update_self on public.myria_goals for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy goals_delete_self on public.myria_goals for delete to authenticated using(user_id=auth.uid());
create policy tasks_select_member on public.myria_tasks for select to authenticated using((project_id is null and user_id=auth.uid()) or (project_id is not null and private.has_project_access(project_id,false)));
create policy tasks_insert_self on public.myria_tasks for insert to authenticated with check(user_id=auth.uid() and (project_id is null or private.has_project_access(project_id,true)));
create policy tasks_update_self on public.myria_tasks for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy tasks_delete_self on public.myria_tasks for delete to authenticated using(user_id=auth.uid());
create policy activity_select_member on public.myria_activity for select to authenticated using((project_id is null and user_id=auth.uid()) or (project_id is not null and private.has_project_access(project_id,false)));
create policy activity_insert_self on public.myria_activity for insert to authenticated with check(user_id=auth.uid());
create policy memory_select_member on public.myria_memory for select to authenticated using(user_id=auth.uid() and private.has_project_access(project_id,false));
create policy memory_insert_self on public.myria_memory for insert to authenticated with check(user_id=auth.uid() and private.has_project_access(project_id,true));
create policy memory_update_self on public.myria_memory for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy memory_delete_self on public.myria_memory for delete to authenticated using(user_id=auth.uid());
create policy conversations_select_member on public.myria_conversations for select to authenticated using(user_id=auth.uid() and (project_id is null or private.has_project_access(project_id,false)));
create policy conversations_insert_self on public.myria_conversations for insert to authenticated with check(user_id=auth.uid() and (project_id is null or private.has_project_access(project_id,false)));

grant select,insert,update,delete on public.projects,public.project_members,public.sections,public.notes,public.project_invites,public.myria_goals,public.myria_tasks,public.myria_activity,public.myria_memory,public.myria_conversations to authenticated;
grant select,update on public.profiles to authenticated;


-- Myria approval gate for medium/high-risk tasks.
create table if not exists public.myria_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null unique references public.myria_tasks(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  risk_level text not null default 'high' check (risk_level in ('medium','high')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reason text not null default '',
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table public.myria_approvals enable row level security;
drop policy if exists approvals_select_member on public.myria_approvals;
drop policy if exists approvals_insert_requester on public.myria_approvals;
drop policy if exists approvals_update_owner on public.myria_approvals;
drop policy if exists approvals_delete_owner on public.myria_approvals;
create policy approvals_select_member on public.myria_approvals for select to authenticated using (private.has_project_access(project_id,false));
create policy approvals_insert_requester on public.myria_approvals for insert to authenticated with check (requested_by=auth.uid() and private.has_project_access(project_id,true));
create policy approvals_update_owner on public.myria_approvals for update to authenticated using (private.is_project_owner(project_id)) with check (private.is_project_owner(project_id) and decided_by=auth.uid());
create policy approvals_delete_owner on public.myria_approvals for delete to authenticated using (private.is_project_owner(project_id));
grant select,insert,update,delete on public.myria_approvals to authenticated;
