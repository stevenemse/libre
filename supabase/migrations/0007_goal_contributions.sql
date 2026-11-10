-- Les versements sur un objectif deviennent de vraies transactions, déduites
-- de l'épargne du mois. La colonne est nullable : les dépenses ordinaires
-- n'ont pas d'objectif associé.
alter table public.transactions
  add column if not exists goal_id uuid references public.goals(id) on delete set null;

create index if not exists transactions_goal_id_idx on public.transactions (goal_id);
