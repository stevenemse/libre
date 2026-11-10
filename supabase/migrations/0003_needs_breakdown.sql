-- Détail des besoins saisi pendant l'onboarding : transport, alimentation, logement.
-- Permet de recalculer les besoins sans redemander un montant global.
alter table public.profiles
  add column if not exists needs_breakdown jsonb not null default '{}'::jsonb;

comment on column public.profiles.needs_breakdown is
  'Détail des besoins courants : { transport: { basis, unitAmount, days }, food: {...}, housing: { rent, bills, other } }';
