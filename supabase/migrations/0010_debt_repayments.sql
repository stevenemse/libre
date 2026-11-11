-- Un remboursement de dette devient une transaction liée : il réduit le solde
-- restant et sort de l'épargne du mois. Un objectif peut aussi viser une dette
-- plutôt qu'une poche : son versement rembourse alors la dette.
alter table public.transactions
  add column if not exists debt_id uuid references public.debts(id) on delete set null;

create index if not exists transactions_debt_id_idx on public.transactions (debt_id);

alter table public.goals
  add column if not exists debt_id uuid references public.debts(id) on delete set null;
