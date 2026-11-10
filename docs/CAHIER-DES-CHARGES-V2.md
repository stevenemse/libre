# Libre — Cahier des charges produit V2

**Statut :** proposition de travail · Novembre 2026
**Dérivé de :** Stratégie produit et commerciale v2.0
**Base de code :** commits `5795176` (MVP V1) et `9773c11` (onboarding détaillé, paramètres)

Ce document traduit la stratégie en décisions techniques et en lots livrables. Il ne remplace pas
la stratégie commerciale : il dit **quoi construire, dans quel ordre, avec quelles règles**.

---

## 0. Décisions actées

| Sujet | Décision | Impact code |
| --- | --- | --- |
| Positionnement | Coach d'indépendance financière, pas un budget-app | La navigation garde ses 8 écrans, mais chaque écran se termine par une action recommandée |
| Cible | 18–35 ans, cœur 22–30 (jeune actif) | Textes et exemples par défaut : salaire, charges familiales, revenus variables |
| Marchés | Panafricain techniquement, lancement commercial Cameroun → Sénégal → Côte d'Ivoire | Devise + pays + fuseau en base dès maintenant, contenus localisés plus tard |
| Modèle | Freemium : Free / Plus 1 000 FCFA/mois / Pro 2 500 FCFA/mois / B2B sur devis | Quotas et droits vérifiés en base, pas seulement dans l'UI |
| Techno | React + TS + PWA + Supabase (conservé) | Aucune migration de stack |
| Rôle réglementaire | Outil de suivi, d'éducation et de simulation | Jamais de détention de fonds, jamais d'exécution de paiement |

**Deux écarts assumés avec la stratégie :**

1. **Portefeuilles :** je ne les mets pas dans le premier lot V1.1. Un vrai suivi multi-portefeuilles
   demande un registre de transactions fiable (soldes dérivés, transferts non comptés comme
   dépenses). Le faire à moitié produit des soldes faux, ce qui détruit la confiance. Lot dédié, §4.2.
2. **Coach IA :** le premier lot livre un coach **déterministe** (règles + données réelles), l'IA
   n'arrivant qu'ensuite pour la formulation et les cas complexes. Un conseil calculé est vérifiable,
   un conseil généré ne l'est pas.

---

## 1. Ce qui est déjà livré (V1)

| Brique | État | Emplacement |
| --- | --- | --- |
| Auth e-mail / mot de passe / lien magique | Livré | `src/pages/Auth.tsx` |
| Onboarding 7 étapes avec besoins détaillés | Livré (`9773c11`) | `src/pages/Onboarding.tsx` |
| Tableau de bord : épargne, taux, cible fonds | Livré | `src/pages/Home.tsx` |
| Transactions, répartition de l'épargne, fonds d'urgence | Livré | `src/pages/Save.tsx` |
| Registre d'assets + simulateur de liberté | Livré | `src/pages/Invest.tsx`, `Freedom.tsx` |
| Conseils, défis, progression | Livré | `src/pages/Tips.tsx` |
| Paramètres, export CSV/JSON, suppression de compte | Livré | `src/pages/Settings.tsx` |
| RLS sur les 14 tables + tests automatisés | Livré | `supabase/migrations/0001_init.sql`, `scripts/test-rls.mjs` |
| Calculs métier testés (31 tests) | Livré | `src/lib/calc.ts`, `calc.test.ts` |

Manquent par rapport à la cible : pays/devise multiples réels, portefeuilles, dettes, revenus
irréguliers qualifiés, bilan hebdomadaire, coach, abonnements et quotas, B2B.

---

## 2. Le parcours et la « prochaine action utile »

Cinq étapes : **Comprendre → Maîtriser → Sécuriser → Construire → Devenir autonome**.

Règle d'affichage (une seule action par écran, calculée, jamais générique) :

| Condition | Action proposée |
| --- | --- |
| Profil non onboardé | Terminer l'estimation |
| Aucune transaction ce mois | Saisir un revenu et une dépense |
| Taux d'épargne < objectif − 5 pts | Réduire une catégorie « envie » (la plus grosse du mois) |
| Fonds d'urgence < 3 mois de besoins | Verser vers le fonds d'urgence |
| Fonds ≥ 6 mois et épargne stable 2 mois | Ouvrir un objectif d'actif |
| Revenu passif ≥ 50 % des besoins | Passer en mode simulation de sortie |

Chaque action porte une **raison chiffrée** (« tes loisirs ont pris 18 % de plus que le mois
dernier ») et un lien direct vers l'écran concerné. C'est ce qui distingue un coach d'un tableau.

---

## 3. Architecture fonctionnelle cible

| Module (stratégie) | Écran actuel | Ce qui s'ajoute |
| --- | --- | --- |
| Mon espace financier | `Home` | Prochaine action utile, patrimoine suivi, progression |
| Mon argent | `Save` | Portefeuilles, dettes, revenus qualifiés, analyses par catégorie |
| Mes objectifs | `Save` / `Invest` | Objectifs typés (fonds, projet, dette), jalons |
| Mon patrimoine | `Invest` / `Freedom` | Revenus générés par actif, valeur nette |
| Mon coach | `Tips` | Bilan hebdomadaire, recommandations contextualisées, formations |

La barre de navigation reste à 5 entrées : Accueil · Argent · Objectifs · Patrimoine · Coach.
Les écrans actuels y sont re-rattachés, aucune route publique ne change.

---

## 4. Modèle de données : migrations à venir

Chaque lot est une migration séparée, avec RLS écrite dans le même fichier et couverte par
`scripts/test-rls.mjs`. Numérotation reprise à `0004` (0002 a été consommée par les récurrences).

### 4.1 `0004_international.sql` — pays, devises, préférences

```sql
create table public.currencies (
  code char(3) primary key,
  name text not null,
  symbol text,
  decimals smallint not null default 0
);

create table public.countries (
  code char(2) primary key,
  name text not null,
  currency_code char(3) not null references public.currencies(code),
  locale text not null default 'fr',
  timezone text not null,
  enabled boolean not null default false
);

alter table public.profiles
  add column if not exists country_code char(2) references public.countries(code),
  add column if not exists timezone text,
  add column if not exists preferred_language text not null default 'fr',
  add column if not exists birth_year smallint;
```

**Règle ferme :** `XAF` et `XOF` sont deux devises distinctes, deux lignes distinctes. Aucune
conversion implicite. Une transaction garde la devise de son portefeuille ; un affichage
multi-devises exige un taux saisi explicitement, jamais inventé.

`countries` est lisible par tous (données de référence), écriture réservée au service.
Le seed initial active : CM, SN, CI, TG, BJ, GA, CG, CD.

### 4.2 `0005_wallets.sql` — portefeuilles et registre

Principe : **le solde n'est jamais un champ modifiable**. Il est dérivé des mouvements.

```sql
create type public.wallet_kind as enum
  ('cash', 'mobile_money', 'bank', 'savings', 'investment');

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  kind public.wallet_kind not null,
  currency_code char(3) not null references public.currencies(code),
  provider text,                       -- Orange Money, Wave, MTN MoMo, banque…
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.wallet_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  source_wallet_id uuid not null references public.wallets(id),
  destination_wallet_id uuid not null references public.wallets(id),
  amount numeric(14,2) not null check (amount > 0),
  fee numeric(14,2) not null default 0 check (fee >= 0),
  occurred_on date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  constraint transfer_distinct check (source_wallet_id <> destination_wallet_id)
);
```

- `transactions` gagne `wallet_id` (nullable, migré vers le portefeuille « espèces » par défaut).
- Un transfert **n'est pas** une dépense : il sort du calcul du taux d'épargne. Seuls les frais
  éventuels sont une dépense (catégorie « frais »).
- Règle d'intégrité : source et destination doivent appartenir au même utilisateur, même devise,
  et le déclencheur vérifie la propriété — pas seulement la policy RLS.
- Le solde est une vue `wallet_balances` : `somme(entrées) − somme(sorties) ± transferts`.

**Coût réel de ce lot :** il touche la saisie, l'édition, la suppression, l'export et le
tableau de bord. C'est le lot le plus risqué du plan, il arrive après le bilan hebdomadaire.

### 4.3 `0006_debts.sql` — dettes et créances

```sql
create type public.debt_direction as enum ('owed_by_me', 'owed_to_me');

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  direction public.debt_direction not null,
  counterparty text,
  principal numeric(14,2) not null check (principal > 0),
  currency_code char(3) not null,
  interest_rate numeric(5,2),
  due_date date,
  status text not null default 'active' check (status in ('active', 'settled', 'written_off')),
  created_at timestamptz not null default now()
);

create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  paid_on date not null default current_date,
  wallet_id uuid references public.wallets(id),
  created_at timestamptz not null default now()
);
```

Un remboursement de dette réduit la marge disponible mais **n'est pas** une dépense de
consommation : il est exclu du taux d'épargne, comme les transferts.

### 4.4 `0007_billing.sql` — offres, quotas, abonnements

```sql
create type public.plan_code as enum ('free', 'plus', 'pro', 'business');

alter table public.profiles
  add column if not exists plan public.plan_code not null default 'free',
  add column if not exists plan_expires_at timestamptz;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  plan public.plan_code not null,
  provider text not null,              -- prestataire de paiement agréé
  provider_ref text,
  status text not null,                -- pending | active | past_due | canceled
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table public.ai_usage (
  user_id uuid not null references auth.users on delete cascade,
  period_start date not null,
  calls int not null default 0,
  tokens int not null default 0,
  primary key (user_id, period_start)
);
```

**Le plan n'est jamais écrit par le client.** Il change uniquement via une fonction serveur
appelée après confirmation du prestataire de paiement. RLS : lecture seule pour l'utilisateur
sur `subscriptions` et `ai_usage`.

### 4.5 `0008_coach.sql` — bilans et recommandations

```sql
create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  week_start date not null,
  income numeric(14,2) not null,
  expenses numeric(14,2) not null,
  saved numeric(14,2) not null,
  payload jsonb not null default '{}'::jsonb,   -- catégories, deltas, actions
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null,
  body text not null,
  reason jsonb not null default '{}'::jsonb,     -- les chiffres qui justifient le conseil
  status text not null default 'open',           -- open | done | dismissed
  created_at timestamptz not null default now()
);
```

---

## 5. Règles métier (à ne pas casser)

Les formules du cahier des charges initial restent la référence, et **tout ce qui est affiché
doit être recalculable à la main** :

- épargne = max(0, revenus − besoins) ; taux = épargne / revenus
- versement par poche = épargne × % / 100 ; cible fonds = besoins × mois
- capital liberté = besoins × 12 × 25 ; revenu passif = capital × 4 % / 12
- capital(n) = capital(n−1) × (1 + i) + versement, i = rendement / 1200

Nouvelles règles :

1. **Revenus irréguliers.** Un revenu peut être `fixed`, `variable` ou `one_off`. Le budget se base
   sur la médiane des 3 derniers mois pleins quand les revenus sont variables, jamais sur le
   meilleur mois. L'écran affiche « base de calcul : médiane des 3 derniers mois ».
2. **Transferts et remboursements** ne sont ni des revenus ni des dépenses de consommation.
3. **Besoin vs envie.** La distinction (`need_kind`) conditionne les conseils : on ne propose
   jamais de réduire un besoin essentiel.
4. **Aucune promesse de rendement.** Le simulateur affiche une hypothèse, avec le mot
   « hypothèse », et une fourchette, jamais un chiffre unique présenté comme acquis.
5. **Bilan hebdomadaire** : généré le lundi pour la semaine écoulée, 4 chiffres + 1 action.
   S'il n'y a aucune donnée, il le dit et propose de saisir, il n'invente pas.

---

## 6. Coach Libre

**Périmètre V1.1 (sans IA) :** règles déterministes sur les données réelles de l'utilisateur —
dérive d'une catégorie, taux d'épargne sous l'objectif, fonds d'urgence insuffisant, dette qui
coûte des intérêts, revenu passif en progression. Chaque recommandation stocke ses chiffres
justificatifs dans `reason`.

**Périmètre V1.2 (avec IA) :** l'IA sert à *expliquer et prioriser*, pas à inventer. Elle reçoit
un résumé structuré (agrégats du mois, deltas, objectifs), jamais l'historique brut de notes.

Garde-fous non négociables :

- La clé du modèle vit côté serveur (Worker/serverless), jamais dans le bundle. **À faire avant
  tout appel IA**, pas après.
- Quota mensuel par plan, vérifié en base (`ai_usage`) avant l'appel, décrémenté après succès.
- Modèle économique pour les analyses courtes, modèle plus capable pour les bilans.
- Cache des réponses réutilisables (même résumé + même question → même réponse).
- Le coach ne recommande jamais un produit financier précis, ne promet aucun rendement, et
  rappelle qu'il ne remplace pas un conseiller agréé.
- Sans IA (quota épuisé, panne), l'app garde **tous** les calculs et le bilan déterministe.

Architecture : une route serveur authentifiée par le jeton Supabase de l'utilisateur, qui
recalcule les agrégats côté serveur (jamais confiance au client) et journalise l'usage.

---

## 7. Monétisation

| Offre | Prix | Contenu | Garde-fou |
| --- | --- | --- | --- |
| Free | 0 | Budget, épargne, fonds d'urgence, objectifs simples, conseils de base, bilan mensuel | Doit rester réellement utile, sinon la conversion n'a pas de sens |
| Plus | 1 000 FCFA/mois · 10 000/an | Coach, bilans personnalisés, dettes, patrimoine, simulations, rapports | Quota IA généreux mais plafonné |
| Pro | 2 500 FCFA/mois · 25 000/an | Multi-activités, prévisions de trésorerie, rapports détaillés | Valeur réelle, pas de bridage artificiel |
| Business | Sur devis | Licences, parcours de formation, tableaux agrégés anonymisés | Anonymisation vérifiable |

Scénario 10 000 actifs (hypothèse, pas prévision) : 700 Plus + 100 Pro ≈ 950 000 FCFA/mois.
À surveiller : coût IA par utilisateur actif, frais de paiement, acquisition, désabonnements.
Cible : marge brute > 70 %, CAC récupéré en quelques mois.

Paiement : prestataire agréé uniquement (Mobile Money / carte selon le pays). Libre ne touche
jamais l'argent de l'utilisateur et ne fait pas de collecte de dépôts.

---

## 8. Feuille de route et critères de sortie

| Lot | Contenu | Critère de sortie |
| --- | --- | --- |
| **V1.1** | Bilan hebdomadaire, revenus qualifiés (fixe/variable/ponctuel), prochaine action utile | Un utilisateur ouvre l'app 3 semaines de suite sans qu'on le lui demande |
| **V1.2** | Coach déterministe + recommandations stockées, détail par catégorie | ≥ 1 recommandation marquée « faite » par utilisateur actif |
| **V1.3** | Dettes et créances | Calcul de marge nette intégrant les remboursements |
| **V1.4** | International réel (pays, devises, formats, contenus CM/SN/CI) | Inscription et usage complets depuis 2 pays |
| **V1.5** | Portefeuilles + transferts + registre fiable | Aucun solde faux après 50 transferts et 200 transactions (test automatisé) |
| **V2.0** | Abonnements, quotas, coach IA côté serveur | Paiement test réussi, quota appliqué, downgrade sans perte de données |
| **V2.5** | B2B : licences, tableaux agrégés, parcours de formation | 1 contrat pilote signé |
| **V3.0** | Import Mobile Money, mode famille, tontines, anglais | À ne planifier qu'après V2.0 |

Instrumentation à poser dès V1.1 (anonyme, sans données financières dans les libellés) :
`onboarding_started/completed`, `transaction_created`, `weekly_review_opened`,
`recommendation_done`, `export_used`, `paywall_viewed`, `subscription_started`.

Objectifs à 6 mois (hypothèses de pilotage) : 5 000 inscrits, onboarding ≥ 70 %, J7 ≥ 25 %,
J30 ≥ 15 %, conversion ≥ 3 %, renouvellement ≥ 80 %. Trois indicateurs qui comptent vraiment :
rétention, activation (une action financière réelle), monétisation.

---

## 9. Sécurité, confidentialité, conformité

- RLS sur **toutes** les nouvelles tables, écrite dans la migration, testée dans `test-rls.mjs`.
  Toute nouvelle table sans test RLS est considérée comme non livrée.
- Aucune clé secrète dans le bundle : la clé publiable reste la seule exposée.
- Chaque fonction SQL `security definer` fixe `search_path` et vérifie `auth.uid()`.
- Export complet et suppression de compte conservés à chaque évolution du schéma (nouvelle table
  = nouvelle ligne dans l'export et dans `delete_my_account`).
- Les données financières ne sont **jamais** vendues ni utilisées pour de la publicité ciblée.
  Argument de marque, pas seulement clause.
- Conformité : outil de suivi et de simulation, pas de services de paiement. Toute évolution
  touchant au mouvement de fonds doit être revue au regard de l'Instruction BCEAO
  n°001-01-2024 (UEMOA) et du règlement CEMAC du 21 décembre 2018.
- Cible 18+ à l'inscription (pas de mineurs), consentement explicite sur les données financières.

---

## 10. Risques et parades

| Risque | Parade produit |
| --- | --- |
| Faible usage quotidien | Saisie en 2 taps, bilan hebdomadaire, rappels non culpabilisants |
| Faible disposition à payer | Free réellement utile, paywall placé sur la valeur perçue (coach), pas sur les calculs |
| Coût IA | Quotas, modèle économique, cache, coach déterministe par défaut |
| Soldes faux (portefeuilles) | Registre dérivé, tests d'intégrité, lot dédié et tardif |
| Méfiance sur les données | RLS vérifiée, export, suppression, transparence sur l'usage |
| Conseils inadaptés | Règles déterministes d'abord, chiffres justificatifs affichés, jamais de promesse |
| Dispersion panafricaine | Un seul couple pays/devise actif à la fois dans l'UI |

---

## 11. Décisions ouvertes (à trancher avant V2.0)

1. **Prestataire de paiement par pays** (Mobile Money CM/SN/CI) : lequel, et qui porte le compte
   marchand ? Décision juridique et commerciale, pas technique.
2. **Coach IA :** quel fournisseur de modèle, quel budget mensuel maximum, quel quota par plan ?
3. **B2B :** l'offre entreprise passe-t-elle par le même produit (licences) ou par un tableau de
   bord séparé ? Impact direct sur le modèle de données.
4. **Politique de confidentialité publique :** à rédiger avant tout lancement commercial, elle
   conditionne les stores et la confiance.
