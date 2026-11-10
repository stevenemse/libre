-- Libre — schéma initial (v1.0)
-- Postgres / Supabase : extensions, types, tables, RLS, déclencheurs, vue et fonctions.
-- Toute règle de sécurité est appliquée en base (RLS), jamais seulement dans le client.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.tx_type as enum ('income', 'expense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.need_kind as enum ('need', 'want');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Profils
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  first_name text,
  currency text not null default 'XAF',
  locale text not null default 'fr',
  life_goal text,
  avg_income numeric(14,2) default 0,
  avg_needs numeric(14,2) default 0,
  savings_rate_goal numeric(5,2) default 20,
  emergency_months int default 6 check (emergency_months between 3 and 12),
  onboarded boolean default false,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Catégories (user_id null = catégorie par défaut globale)
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  name text not null,
  type public.tx_type not null,
  kind public.need_kind,
  icon text,
  is_default boolean default false
);

create index if not exists categories_user_idx on public.categories (user_id);

-- ---------------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  category_id uuid references public.categories,
  type public.tx_type not null,
  amount numeric(14,2) not null check (amount > 0),
  occurred_on date not null default current_date,
  note text,
  recurrence text check (recurrence in ('none', 'weekly', 'monthly')) default 'none',
  parent_tx_id uuid references public.transactions on delete cascade,
  created_at timestamptz default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, occurred_on desc);

-- ---------------------------------------------------------------------------
-- Répartition de l'épargne
-- ---------------------------------------------------------------------------
create table if not exists public.allocations (
  user_id uuid primary key references auth.users on delete cascade,
  pct_subsistence numeric(5,2) not null default 25,
  pct_assets numeric(5,2) not null default 50,
  pct_protection numeric(5,2) not null default 25,
  updated_at timestamptz default now(),
  check (pct_subsistence + pct_assets + pct_protection = 100)
);

-- ---------------------------------------------------------------------------
-- Fonds d'urgence
-- ---------------------------------------------------------------------------
create table if not exists public.emergency_fund (
  user_id uuid primary key references auth.users on delete cascade,
  amount_saved numeric(14,2) not null default 0,
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Check-list de protection
-- ---------------------------------------------------------------------------
create table if not exists public.protection_checklist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  item_key text not null,
  done boolean default false,
  unique (user_id, item_key)
);

-- ---------------------------------------------------------------------------
-- Assets
-- ---------------------------------------------------------------------------
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  asset_type text not null,
  value numeric(14,2) default 0,
  monthly_income numeric(14,2) default 0,
  acquired_on date,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Objectifs
-- ---------------------------------------------------------------------------
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null,
  current_amount numeric(14,2) default 0,
  target_date date,
  pocket text check (pocket in ('subsistence', 'assets', 'protection')),
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Simulations
-- ---------------------------------------------------------------------------
create table if not exists public.simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  label text,
  monthly_needs numeric(14,2),
  monthly_contribution numeric(14,2),
  annual_return numeric(5,2),
  horizon_years int,
  start_capital numeric(14,2) default 0,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Conseils
-- ---------------------------------------------------------------------------
create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('Épargner', 'Investir', 'Protéger', 'Mentalité')),
  level text not null default 'Débutant',
  title text not null,
  body text not null,
  locale text not null default 'fr',
  published boolean default true
);

create table if not exists public.tip_progress (
  user_id uuid references auth.users on delete cascade,
  tip_id uuid references public.tips on delete cascade,
  read_at timestamptz,
  favorite boolean default false,
  primary key (user_id, tip_id)
);

-- ---------------------------------------------------------------------------
-- Défis
-- ---------------------------------------------------------------------------
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  duration_days int not null
);

create table if not exists public.user_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  challenge_id uuid references public.challenges,
  started_on date default current_date,
  completed boolean default false
);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users on delete cascade,
  daily_reminder boolean default true,
  payday_reminder boolean default true,
  budget_alert boolean default true,
  monthly_summary boolean default true,
  push_subscription jsonb
);

-- ---------------------------------------------------------------------------
-- Vue de synthèse mensuelle
-- ---------------------------------------------------------------------------
create or replace view public.monthly_summary
with (security_invoker = true) as
select
  t.user_id,
  date_trunc('month', t.occurred_on)::date as month,
  sum(t.amount) filter (where t.type = 'income') as income,
  sum(t.amount) filter (where t.type = 'expense' and c.kind = 'need') as needs,
  sum(t.amount) filter (where t.type = 'expense' and c.kind = 'want') as wants
from public.transactions t
left join public.categories c on c.id = t.category_id
group by 1, 2;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.allocations enable row level security;
alter table public.emergency_fund enable row level security;
alter table public.protection_checklist enable row level security;
alter table public.assets enable row level security;
alter table public.goals enable row level security;
alter table public.simulations enable row level security;
alter table public.tips enable row level security;
alter table public.tip_progress enable row level security;
alter table public.challenges enable row level security;
alter table public.user_challenges enable row level security;
alter table public.notification_settings enable row level security;

-- profiles : auth.uid() = id
drop policy if exists own_profile on public.profiles;
create policy own_profile on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- catégories : lecture si globale ou personnelle, écriture si personnelle
drop policy if exists read_categories on public.categories;
create policy read_categories on public.categories
  for select using (user_id is null or user_id = auth.uid());

drop policy if exists write_categories on public.categories;
create policy write_categories on public.categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- tables utilisateur : own_rows
drop policy if exists own_rows on public.transactions;
create policy own_rows on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists own_rows on public.allocations;
create policy own_rows on public.allocations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists own_rows on public.emergency_fund;
create policy own_rows on public.emergency_fund
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists own_rows on public.protection_checklist;
create policy own_rows on public.protection_checklist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists own_rows on public.assets;
create policy own_rows on public.assets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists own_rows on public.goals;
create policy own_rows on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists own_rows on public.simulations;
create policy own_rows on public.simulations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists own_rows on public.tip_progress;
create policy own_rows on public.tip_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists own_rows on public.user_challenges;
create policy own_rows on public.user_challenges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists own_rows on public.notification_settings;
create policy own_rows on public.notification_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- contenus publics : lecture pour tout utilisateur connecté, écriture service role uniquement
drop policy if exists read_tips on public.tips;
create policy read_tips on public.tips for select to authenticated using (published);

drop policy if exists read_challenges on public.challenges;
create policy read_challenges on public.challenges for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Déclencheurs
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists allocations_touch on public.allocations;
create trigger allocations_touch before update on public.allocations
  for each row execute function public.touch_updated_at();

drop trigger if exists emergency_fund_touch on public.emergency_fund;
create trigger emergency_fund_touch before update on public.emergency_fund
  for each row execute function public.touch_updated_at();

-- Création automatique du profil et des lignes liées + catégories par défaut
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'first_name', ''))
  on conflict (id) do nothing;

  insert into public.allocations (user_id) values (new.id) on conflict do nothing;
  insert into public.emergency_fund (user_id) values (new.id) on conflict do nothing;
  insert into public.notification_settings (user_id) values (new.id) on conflict do nothing;

  insert into public.categories (user_id, name, type, kind, icon, is_default)
  select new.id, c.name, c.type::public.tx_type, c.kind::public.need_kind, c.icon, true
  from (values
    ('Loyer', 'expense', 'need', 'home'),
    ('Nourriture', 'expense', 'need', 'shopping-basket'),
    ('Transport', 'expense', 'need', 'bus'),
    ('Santé', 'expense', 'need', 'heart-pulse'),
    ('Factures', 'expense', 'need', 'receipt'),
    ('Scolarité', 'expense', 'need', 'graduation-cap'),
    ('Sorties', 'expense', 'want', 'party-popper'),
    ('Loisirs', 'expense', 'want', 'gamepad-2'),
    ('Shopping', 'expense', 'want', 'shopping-bag'),
    ('Salaire', 'income', null, 'briefcase'),
    ('Business', 'income', null, 'store'),
    ('Freelance', 'income', null, 'laptop'),
    ('Aide familiale', 'income', null, 'hand-heart'),
    ('Autre revenu', 'income', null, 'plus')
  ) as c(name, type, kind, icon);

  insert into public.protection_checklist (user_id, item_key)
  select new.id, k
  from unnest(array['health_insurance', 'activity_insurance', 'documents', 'income_sources', 'trusted_contact']) as k;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Transactions récurrentes (F2) : génère les échéances dues pour l'utilisateur courant
-- ---------------------------------------------------------------------------
create or replace function public.generate_recurring_transactions()
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  tpl record;
  last_date date;
  next_date date;
  created int := 0;
begin
  for tpl in
    select id, user_id, category_id, type, amount, note, recurrence, occurred_on
    from public.transactions
    where user_id = auth.uid()
      and recurrence in ('weekly', 'monthly')
  loop
    select max(occurred_on) into last_date
    from public.transactions
    where id = tpl.id or parent_tx_id = tpl.id;

    next_date := case
      when tpl.recurrence = 'weekly' then last_date + interval '7 days'
      else last_date + interval '1 month'
    end::date;

    while next_date <= current_date loop
      insert into public.transactions
        (user_id, category_id, type, amount, occurred_on, note, recurrence, parent_tx_id)
      values
        (tpl.user_id, tpl.category_id, tpl.type, tpl.amount, next_date, tpl.note, 'none', tpl.id);
      created := created + 1;
      next_date := case
        when tpl.recurrence = 'weekly' then next_date + interval '7 days'
        else next_date + interval '1 month'
      end::date;
    end loop;
  end loop;
  return created;
end $$;

-- ---------------------------------------------------------------------------
-- Suppression complète du compte (F12) — supprime auth.users, le reste suit en cascade
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from auth.users where id = auth.uid();
end $$;

grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.generate_recurring_transactions() to authenticated;

-- ---------------------------------------------------------------------------
-- Réglages : durées de conservation et permissions
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.tips, public.challenges to authenticated;
grant select, insert, update, delete on
  public.profiles, public.categories, public.transactions, public.allocations,
  public.emergency_fund, public.protection_checklist, public.assets, public.goals,
  public.simulations, public.tip_progress, public.user_challenges,
  public.notification_settings
to authenticated;
grant select on public.monthly_summary to authenticated;
