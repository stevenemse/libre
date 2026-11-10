-- Libre — visite guidée
-- Marque le guide de démarrage comme vu, pour ne pas le réafficher à chaque
-- connexion (et pour permettre de le revoir depuis les paramètres).

alter table public.profiles
  add column if not exists tour_done boolean not null default false;

comment on column public.profiles.tour_done is
  'Vrai quand la visite guidée de démarrage a été terminée ou passée.';
