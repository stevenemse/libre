-- Libre — lot V1.1
-- Revenus qualifiés, objectifs pilotés, défis, bilan hebdomadaire, notifications push.

-- ---------------------------------------------------------------------------
-- Revenus qualifiés : fixe, variable, ponctuel
-- ---------------------------------------------------------------------------
alter table public.transactions
  add column if not exists income_kind text;

do $$ begin
  alter table public.transactions
    add constraint transactions_income_kind_check
    check (income_kind is null or income_kind in ('fixed', 'variable', 'one_off'));
exception when duplicate_object then null; end $$;

comment on column public.transactions.income_kind is
  'Qualification des revenus : fixed (salaire), variable (activité), one_off (ponctuel). Nul pour une dépense.';

-- ---------------------------------------------------------------------------
-- Objectifs : rythme de versement et archivage
-- ---------------------------------------------------------------------------
alter table public.goals
  add column if not exists monthly_contribution numeric(14,2) not null default 0,
  add column if not exists archived boolean not null default false;

create index if not exists goals_user_idx
  on public.goals (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Défis : suivi réel de la progression
-- ---------------------------------------------------------------------------
alter table public.user_challenges
  add column if not exists check_ins int not null default 0,
  add column if not exists completed_at timestamptz;

create index if not exists user_challenges_user_idx
  on public.user_challenges (user_id, started_on desc);

-- ---------------------------------------------------------------------------
-- Notifications : bilan hebdomadaire et heure du rappel
-- ---------------------------------------------------------------------------
alter table public.notification_settings
  add column if not exists weekly_review boolean not null default true,
  add column if not exists reminder_hour smallint not null default 19;

do $$ begin
  alter table public.notification_settings
    add constraint notification_settings_reminder_hour_check
    check (reminder_hour between 0 and 23);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Abonnements push (un par appareil)
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists own_rows on public.push_subscriptions;
create policy own_rows on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
