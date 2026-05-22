create or replace function public.nexus_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_nexus_updated_at'
  ) then
    alter function public.set_nexus_updated_at() set search_path = '';
  end if;
end;
$$;

drop index if exists public.nexus_user_data_user_collection_updated_idx;

revoke all on public.nexus_profiles from anon;
revoke all on public.nexus_desktop_devices from anon;
revoke all on public.nexus_user_data from anon;
revoke all on public.nexus_profiles from authenticated;
revoke all on public.nexus_desktop_devices from authenticated;
revoke all on public.nexus_user_data from authenticated;

grant select, insert, update on public.nexus_profiles to authenticated;
grant select, insert, update on public.nexus_desktop_devices to authenticated;
grant select, insert, update, delete on public.nexus_user_data to authenticated;

drop policy if exists nexus_profiles_select_own on public.nexus_profiles;
create policy nexus_profiles_select_own
  on public.nexus_profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists nexus_profiles_insert_own on public.nexus_profiles;
create policy nexus_profiles_insert_own
  on public.nexus_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists nexus_profiles_update_own on public.nexus_profiles;
create policy nexus_profiles_update_own
  on public.nexus_profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists nexus_desktop_devices_select_own on public.nexus_desktop_devices;
create policy nexus_desktop_devices_select_own
  on public.nexus_desktop_devices
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists nexus_desktop_devices_insert_own on public.nexus_desktop_devices;
create policy nexus_desktop_devices_insert_own
  on public.nexus_desktop_devices
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists nexus_desktop_devices_update_own on public.nexus_desktop_devices;
create policy nexus_desktop_devices_update_own
  on public.nexus_desktop_devices
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists nexus_user_data_select_own on public.nexus_user_data;
create policy nexus_user_data_select_own
  on public.nexus_user_data
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists nexus_user_data_insert_own on public.nexus_user_data;
create policy nexus_user_data_insert_own
  on public.nexus_user_data
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists nexus_user_data_update_own on public.nexus_user_data;
create policy nexus_user_data_update_own
  on public.nexus_user_data
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists nexus_user_data_delete_own on public.nexus_user_data;
create policy nexus_user_data_delete_own
  on public.nexus_user_data
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

do $$
begin
  if to_regclass('public.nexus_desktop_auth_requests') is not null then
    create index if not exists nexus_desktop_auth_requests_user_id_idx
      on public.nexus_desktop_auth_requests (user_id);
  end if;
end;
$$;
