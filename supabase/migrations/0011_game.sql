-- Parcours Libre : le check-in quotidien d'un défi est daté pour ne compter
-- qu'une fois par jour et alimenter la série et la quête du jour.
alter table public.user_challenges
  add column if not exists last_check_in date;
