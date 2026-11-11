-- Dettes et créances : ce que je dois (mensualité obligatoire, solde restant)
-- et ce qu'on me doit. Les remboursements réduisent la marge disponible et le
-- patrimoine net, sans être comptés comme une dépense de consommation.
do $$
begin
  create type public.debt_direction as enum ('owed_by_me', 'owed_to_me');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  direction public.debt_direction not null default 'owed_by_me',
  counterparty text,
  balance numeric(14,2) not null default 0 check (balance >= 0),
  monthly_payment numeric(14,2) not null default 0 check (monthly_payment >= 0),
  interest_rate numeric(5,2),
  due_date date,
  created_at timestamptz not null default now()
);

create index if not exists debts_user_idx on public.debts (user_id);

alter table public.debts enable row level security;

drop policy if exists own_rows on public.debts;
create policy own_rows on public.debts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
