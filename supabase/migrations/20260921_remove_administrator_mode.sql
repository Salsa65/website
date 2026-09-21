begin;

create or replace function private.has_project_access(pid uuid, require_edit boolean default false)
returns boolean
language sql
stable
security definer
set search_path=public,private,auth,pg_temp
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.project_members pm
    where pm.project_id=pid
      and pm.user_id=(select auth.uid())
      and (not require_edit or pm.role in ('owner','editor'))
  )
$$;

create or replace function private.is_project_owner(pid uuid)
returns boolean
language sql
stable
security definer
set search_path=public,private,auth,pg_temp
as $$
  select (select auth.uid()) is not null and exists(
    select 1 from public.projects p
    where p.id=pid and p.owner_id=(select auth.uid())
  )
$$;

create or replace function private.shares_project_with(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path=public,private,auth,pg_temp
as $$
  select (select auth.uid())=target_user
  or exists (
    select 1
    from public.project_members a
    join public.project_members b on b.project_id=a.project_id
    where a.user_id=(select auth.uid()) and b.user_id=target_user
  )
$$;

drop policy if exists activity_insert_self on public.myria_activity;
create policy activity_insert_self
on public.myria_activity for insert to authenticated
with check (user_id=(select auth.uid()));

drop policy if exists approvals_insert_requester on public.myria_approvals;
create policy approvals_insert_requester
on public.myria_approvals for insert to authenticated
with check (
  requested_by=(select auth.uid())
  and private.has_project_access(project_id,true)
);

drop policy if exists conversations_insert_self on public.myria_conversations;
create policy conversations_insert_self
on public.myria_conversations for insert to authenticated
with check (
  user_id=(select auth.uid())
  and (project_id is null or private.has_project_access(project_id,false))
);

drop policy if exists conversations_select_member on public.myria_conversations;
create policy conversations_select_member
on public.myria_conversations for select to authenticated
using (
  user_id=(select auth.uid())
  and (project_id is null or private.has_project_access(project_id,false))
);

drop policy if exists goals_delete_self on public.myria_goals;
create policy goals_delete_self
on public.myria_goals for delete to authenticated
using (user_id=(select auth.uid()));

drop policy if exists goals_insert_self on public.myria_goals;
create policy goals_insert_self
on public.myria_goals for insert to authenticated
with check (
  user_id=(select auth.uid())
  and (project_id is null or private.has_project_access(project_id,true))
);

drop policy if exists goals_update_self on public.myria_goals;
create policy goals_update_self
on public.myria_goals for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));

drop policy if exists memory_delete_self on public.myria_memory;
create policy memory_delete_self
on public.myria_memory for delete to authenticated
using (user_id=(select auth.uid()));

drop policy if exists memory_insert_self on public.myria_memory;
create policy memory_insert_self
on public.myria_memory for insert to authenticated
with check (
  user_id=(select auth.uid())
  and private.has_project_access(project_id,true)
);

drop policy if exists memory_select_member on public.myria_memory;
create policy memory_select_member
on public.myria_memory for select to authenticated
using (
  user_id=(select auth.uid())
  and private.has_project_access(project_id,false)
);

drop policy if exists memory_update_self on public.myria_memory;
create policy memory_update_self
on public.myria_memory for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));

drop policy if exists tasks_delete_self on public.myria_tasks;
create policy tasks_delete_self
on public.myria_tasks for delete to authenticated
using (user_id=(select auth.uid()));

drop policy if exists tasks_insert_self on public.myria_tasks;
create policy tasks_insert_self
on public.myria_tasks for insert to authenticated
with check (
  user_id=(select auth.uid())
  and (project_id is null or private.has_project_access(project_id,true))
);

drop policy if exists tasks_update_self on public.myria_tasks;
create policy tasks_update_self
on public.myria_tasks for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));

drop policy if exists notes_insert_editor on public.notes;
create policy notes_insert_editor
on public.notes for insert to authenticated
with check (
  private.has_project_access(project_id,true)
  and author_id=(select auth.uid())
);

drop policy if exists invites_insert_editor on public.project_invites;
create policy invites_insert_editor
on public.project_invites for insert to authenticated
with check (
  private.has_project_access(project_id,true)
  and invited_by=(select auth.uid())
);

drop policy if exists "messages read" on public.project_messages;
create policy "messages read"
on public.project_messages for select to authenticated
using (private.project_role(project_id) is not null);

drop policy if exists "sections read" on public.project_sections;
create policy "sections read"
on public.project_sections for select to authenticated
using (private.project_role(project_id) is not null);

drop policy if exists "sections write" on public.project_sections;
create policy "sections write"
on public.project_sections for all to authenticated
using (private.project_role(project_id) in ('owner','editor'))
with check (private.project_role(project_id) in ('owner','editor'));

drop policy if exists projects_update_owner on public.projects;
create policy projects_update_owner
on public.projects for update to authenticated
using (private.is_project_owner(id))
with check ((select auth.uid())=owner_id);

drop policy if exists sections_insert_editor on public.sections;
create policy sections_insert_editor
on public.sections for insert to authenticated
with check (
  private.has_project_access(project_id,true)
  and created_by=(select auth.uid())
);

drop policy if exists "roles own read" on public.user_roles;
create policy "roles own read"
on public.user_roles for select to authenticated
using (user_id=(select auth.uid()));

drop function if exists private.is_admin();

commit;
