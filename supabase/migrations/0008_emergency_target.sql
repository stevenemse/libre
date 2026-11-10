-- Permet de fixer manuellement le palier du fonds d'urgence, indépendamment
-- du calcul « besoins × mois ». Null = calcul automatique.
alter table public.emergency_fund
  add column if not exists target_amount numeric;

-- RLS : la colonne hérite des politiques existantes sur la table.