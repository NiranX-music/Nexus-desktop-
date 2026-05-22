create extension if not exists pgcrypto;

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

create table if not exists public.nexus_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nexus_desktop_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_name text,
  app_version text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nexus_user_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text,
  collection text not null,
  item_key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nexus_profiles add column if not exists avatar_url text;
alter table public.nexus_desktop_devices add column if not exists app_version text;
alter table public.nexus_desktop_devices add column if not exists last_seen_at timestamptz not null default now();
alter table public.nexus_user_data add column if not exists device_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.nexus_desktop_devices'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (user_id, device_id)'
  ) then
    alter table public.nexus_desktop_devices
      add constraint nexus_desktop_devices_user_device_key unique (user_id, device_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.nexus_user_data'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (user_id, collection, item_key)'
  ) then
    alter table public.nexus_user_data
      add constraint nexus_user_data_user_collection_item_key unique (user_id, collection, item_key);
  end if;
end;
$$;

create index if not exists nexus_user_data_lookup_idx
  on public.nexus_user_data (user_id, collection, updated_at desc);

create index if not exists nexus_desktop_devices_user_seen_idx
  on public.nexus_desktop_devices (user_id, last_seen_at desc);

drop trigger if exists nexus_profiles_set_updated_at on public.nexus_profiles;
create trigger nexus_profiles_set_updated_at
  before update on public.nexus_profiles
  for each row execute function public.nexus_set_updated_at();

drop trigger if exists nexus_desktop_devices_set_updated_at on public.nexus_desktop_devices;
create trigger nexus_desktop_devices_set_updated_at
  before update on public.nexus_desktop_devices
  for each row execute function public.nexus_set_updated_at();

drop trigger if exists nexus_user_data_set_updated_at on public.nexus_user_data;
create trigger nexus_user_data_set_updated_at
  before update on public.nexus_user_data
  for each row execute function public.nexus_set_updated_at();

alter table public.nexus_profiles enable row level security;
alter table public.nexus_desktop_devices enable row level security;
alter table public.nexus_user_data enable row level security;

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
