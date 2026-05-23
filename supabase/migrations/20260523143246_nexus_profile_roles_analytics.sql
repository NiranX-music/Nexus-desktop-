create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

alter table public.nexus_profiles add column if not exists role text;
alter table public.nexus_profiles alter column role set default 'user';
update public.nexus_profiles
set role = 'user'
where role is null or role not in ('user', 'admin');
alter table public.nexus_profiles alter column role set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.nexus_profiles'::regclass
      and conname = 'nexus_profiles_role_check'
  ) then
    alter table public.nexus_profiles
      add constraint nexus_profiles_role_check check (role in ('user', 'admin'));
  end if;
end;
$$;

create or replace function private.nexus_role_for_email(email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(btrim(coalesce(email, ''))) = 'niranjanbarhate64@gmail.com' then 'admin'
    else 'user'
  end;
$$;

create or replace function private.nexus_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.nexus_role_for_email(auth.email()) = 'admin'
    or exists (
      select 1
      from public.nexus_profiles profile
      where profile.id = auth.uid()
        and profile.role = 'admin'
    ),
    false
  );
$$;

revoke all on function private.nexus_role_for_email(text) from public;
revoke all on function private.nexus_is_admin() from public;
grant execute on function private.nexus_role_for_email(text) to authenticated;
grant execute on function private.nexus_is_admin() to authenticated;

insert into public.nexus_profiles (id, email, display_name, role)
select
  users.id,
  users.email,
  coalesce(
    users.raw_user_meta_data ->> 'full_name',
    users.raw_user_meta_data ->> 'name',
    split_part(coalesce(users.email, 'Nexus Operator'), '@', 1)
  ),
  private.nexus_role_for_email(users.email)
from auth.users users
where users.email is not null
on conflict (id) do update
set
  email = excluded.email,
  display_name = coalesce(public.nexus_profiles.display_name, excluded.display_name),
  role = case
    when excluded.role = 'admin' then 'admin'
    else public.nexus_profiles.role
  end,
  updated_at = now();

create index if not exists nexus_profiles_email_idx
  on public.nexus_profiles (lower(email));

create index if not exists nexus_profiles_role_idx
  on public.nexus_profiles (role);

create table if not exists public.nexus_site_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  profile_email text,
  visitor_id text,
  visit_path text not null default '/',
  ip_address inet,
  user_agent text,
  referrer text,
  metadata jsonb not null default '{}'::jsonb,
  visited_at timestamptz not null default now()
);

create table if not exists public.nexus_button_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  profile_email text,
  visitor_id text,
  button_label text not null,
  page text,
  element_tag text,
  metadata jsonb not null default '{}'::jsonb,
  clicked_at timestamptz not null default now()
);

create index if not exists nexus_site_visits_visited_at_idx
  on public.nexus_site_visits (visited_at desc);

create index if not exists nexus_site_visits_user_visited_at_idx
  on public.nexus_site_visits (user_id, visited_at desc);

create index if not exists nexus_button_clicks_clicked_at_idx
  on public.nexus_button_clicks (clicked_at desc);

create index if not exists nexus_button_clicks_user_clicked_at_idx
  on public.nexus_button_clicks (user_id, clicked_at desc);

alter table public.nexus_profiles enable row level security;
alter table public.nexus_site_visits enable row level security;
alter table public.nexus_button_clicks enable row level security;

revoke all on public.nexus_profiles from anon;
revoke all on public.nexus_site_visits from anon;
revoke all on public.nexus_button_clicks from anon;
revoke all on public.nexus_profiles from authenticated;
revoke all on public.nexus_site_visits from authenticated;
revoke all on public.nexus_button_clicks from authenticated;

grant select, insert on public.nexus_profiles to authenticated;
grant update (email, display_name, avatar_url, role, updated_at) on public.nexus_profiles to authenticated;

grant insert on public.nexus_site_visits to anon, authenticated;
grant select on public.nexus_site_visits to authenticated;

grant insert on public.nexus_button_clicks to anon, authenticated;
grant select on public.nexus_button_clicks to authenticated;

drop policy if exists nexus_profiles_select_own on public.nexus_profiles;
drop policy if exists nexus_profiles_insert_own on public.nexus_profiles;
drop policy if exists nexus_profiles_update_own on public.nexus_profiles;
drop policy if exists nexus_profiles_select_own_or_admin on public.nexus_profiles;
create policy nexus_profiles_select_own_or_admin
  on public.nexus_profiles
  for select
  to authenticated
  using ((select auth.uid()) = id or private.nexus_is_admin());

drop policy if exists nexus_profiles_insert_self on public.nexus_profiles;
create policy nexus_profiles_insert_self
  on public.nexus_profiles
  for insert
  to authenticated
  with check (
    (select auth.uid()) = id
    and lower(coalesce(email, '')) = lower(coalesce((select auth.email()), ''))
    and role = private.nexus_role_for_email((select auth.email()))
  );

drop policy if exists nexus_profiles_update_self_profile on public.nexus_profiles;
create policy nexus_profiles_update_self_profile
  on public.nexus_profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check (
    (select auth.uid()) = id
    and lower(coalesce(email, '')) = lower(coalesce((select auth.email()), ''))
    and role = private.nexus_role_for_email((select auth.email()))
  );

drop policy if exists nexus_profiles_update_admin on public.nexus_profiles;
create policy nexus_profiles_update_admin
  on public.nexus_profiles
  for update
  to authenticated
  using (private.nexus_is_admin())
  with check (role in ('user', 'admin'));

drop policy if exists nexus_site_visits_insert_anon on public.nexus_site_visits;
create policy nexus_site_visits_insert_anon
  on public.nexus_site_visits
  for insert
  to anon
  with check (user_id is null);

drop policy if exists nexus_site_visits_insert_auth on public.nexus_site_visits;
create policy nexus_site_visits_insert_auth
  on public.nexus_site_visits
  for insert
  to authenticated
  with check (user_id is null or (select auth.uid()) = user_id);

drop policy if exists nexus_site_visits_select_own_or_admin on public.nexus_site_visits;
create policy nexus_site_visits_select_own_or_admin
  on public.nexus_site_visits
  for select
  to authenticated
  using ((select auth.uid()) = user_id or private.nexus_is_admin());

drop policy if exists nexus_button_clicks_insert_anon on public.nexus_button_clicks;
create policy nexus_button_clicks_insert_anon
  on public.nexus_button_clicks
  for insert
  to anon
  with check (user_id is null);

drop policy if exists nexus_button_clicks_insert_auth on public.nexus_button_clicks;
create policy nexus_button_clicks_insert_auth
  on public.nexus_button_clicks
  for insert
  to authenticated
  with check (user_id is null or (select auth.uid()) = user_id);

drop policy if exists nexus_button_clicks_select_own_or_admin on public.nexus_button_clicks;
create policy nexus_button_clicks_select_own_or_admin
  on public.nexus_button_clicks
  for select
  to authenticated
  using ((select auth.uid()) = user_id or private.nexus_is_admin());
