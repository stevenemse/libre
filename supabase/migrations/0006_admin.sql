-- Libre — panel administrateur (vue d'ensemble pour l'opérateur)
--
-- Le rôle admin est porté par profiles.is_admin. Il n'est jamais lisible comme
-- un droit accordé par le client : toutes les fonctions d'administration
-- vérifient public.is_admin() côté base, et les agrégats passent par des
-- fonctions SECURITY DEFINER qui contournent volontairement la RLS.
--
-- Aucune donnée financière individuelle n'est exposée : uniquement des comptes
-- (e-mail, prénom, date d'inscription), des volumes et des contrôles d'intégrité.

-- ---------------------------------------------------------------------------
-- Rôle administrateur
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Vrai pour l''opérateur du projet : accès au panel /admin. Jamais modifiable côté client.';

-- Un utilisateur ne peut pas se promouvoir lui-même : on retire is_admin des
-- colonnes modifiables par le client via la policy existante.
create or replace function public.protect_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() n'est renseigné que pour un appel client : un accès SQL direct
  -- (migration, opérateur) reste autorisé à changer le rôle.
  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and not public.is_admin_system() then
    new.is_admin := old.is_admin;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Clés opérationnelles (mode maintenance, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.meta (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.meta is
  'Clés opérationnelles du projet (maintenance, etc.). Aucune donnée utilisateur.';

alter table public.meta enable row level security;

drop policy if exists read_maintenance_flag on public.meta;
create policy read_maintenance_flag on public.meta
  for select to authenticated using (key = 'maintenance');

insert into public.meta (key, value)
values ('maintenance', '{"active": false, "message": ""}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Lecture du rôle admin, sans récursion RLS.
create or replace function public.is_admin_system()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Alias public utilisé par l'application.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_system();
$$;

grant execute on function public.is_admin() to authenticated;

-- Le trigger peut maintenant utiliser le helper : on le crée après lui.
drop trigger if exists profiles_protect_admin on public.profiles;
create trigger profiles_protect_admin before update on public.profiles
  for each row execute function public.protect_admin_flag();

-- ---------------------------------------------------------------------------
-- Mode maintenance (pause / réparation)
-- ---------------------------------------------------------------------------
create or replace function public.maintenance_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (value ->> 'active')::boolean from public.meta where key = 'maintenance'),
    false
  );
$$;

grant execute on function public.maintenance_active() to anon, authenticated;

create or replace function public.admin_set_maintenance(active boolean, message text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_system() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.meta (key, value, updated_at)
  values ('maintenance', jsonb_build_object('active', active, 'message', coalesce(message, '')), now())
  on conflict (key) do update
    set value = excluded.value,
        updated_at = now();
end $$;

-- ---------------------------------------------------------------------------
-- Stats globales
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if not public.is_admin_system() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'accounts', (select count(*) from public.profiles),
    'onboarded', (select count(*) from public.profiles where onboarded),
    'admins', (select count(*) from public.profiles where is_admin),
    'new7', (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'new30', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
    'active30', (
      select count(distinct t.user_id)
      from public.transactions t
      where t.occurred_on >= current_date - 30
    ),
    'confirmed', (
      select count(*) from auth.users u where u.email_confirmed_at is not null
    ),
    'transactions', (select count(*) from public.transactions),
    'transactions30', (
      select count(*) from public.transactions
      where occurred_on >= current_date - 30
    ),
    'assets', (select count(*) from public.assets),
    'pushDevices', (select count(*) from public.push_subscriptions),
    'maintenance', public.maintenance_active()
  ) into result;

  return result;
end $$;

-- ---------------------------------------------------------------------------
-- Liste des comptes
-- ---------------------------------------------------------------------------
create or replace function public.admin_accounts(limit_n int default 100)
returns table (
  id uuid,
  email text,
  first_name text,
  currency text,
  onboarded boolean,
  is_admin boolean,
  email_confirmed boolean,
  created_at timestamptz,
  transactions bigint,
  last_activity date
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin_system() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select
      p.id,
      u.email::text,
      p.first_name,
      p.currency,
      p.onboarded,
      p.is_admin,
      (u.email_confirmed_at is not null) as email_confirmed,
      p.created_at,
      coalesce(t.cnt, 0) as transactions,
      t.last_on as last_activity
    from public.profiles p
    join auth.users u on u.id = p.id
    left join (
      select
        tx.user_id,
        count(*) as cnt,
        max(tx.occurred_on) as last_on
      from public.transactions tx
      group by tx.user_id
    ) t on t.user_id = p.id
    order by p.created_at desc
    limit greatest(1, least(coalesce(limit_n, 100), 500));
end $$;

-- ---------------------------------------------------------------------------
-- Contrôle de la base (intégrité)
-- ---------------------------------------------------------------------------
create or replace function public.admin_db_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if not public.is_admin_system() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'profilesWithoutAllocation', (
      select count(*) from public.profiles p
      where not exists (select 1 from public.allocations a where a.user_id = p.id)
    ),
    'profilesWithoutEmergencyFund', (
      select count(*) from public.profiles p
      where not exists (select 1 from public.emergency_fund e where e.user_id = p.id)
    ),
    'profilesWithoutNotifications', (
      select count(*) from public.profiles p
      where not exists (select 1 from public.notification_settings n where n.user_id = p.id)
    ),
    'profilesNotOnboarded', (
      select count(*) from public.profiles where not onboarded
    ),
    'transactionsWithoutCategory', (
      select count(*) from public.transactions where category_id is null
    ),
    'orphanTransactions', (
      select count(*) from public.transactions t
      where not exists (select 1 from public.profiles p where p.id = t.user_id)
    ),
    'tipsPublished', (select count(*) from public.tips where published),
    'challenges', (select count(*) from public.challenges)
  ) into result;

  return result;
end $$;

-- ---------------------------------------------------------------------------
-- Permissions : jamais pour anon, et les fonctions vérifient is_admin()
-- ---------------------------------------------------------------------------
revoke all on function public.admin_overview() from public;
revoke all on function public.admin_accounts(int) from public;
revoke all on function public.admin_db_health() from public;
revoke all on function public.admin_set_maintenance(boolean, text) from public;

grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_accounts(int) to authenticated;
grant execute on function public.admin_db_health() to authenticated;
grant execute on function public.admin_set_maintenance(boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Désignation de l'opérateur (à exécuter une fois, en local, par un admin SQL)
-- ---------------------------------------------------------------------------
-- update public.profiles set is_admin = true
-- where id = (select id from auth.users where email = 'steveemse@gmail.com');
