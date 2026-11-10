# Libre

**Richesse = liberté.**

Libre est un compagnon financier pour les **18–35 ans** qui veulent devenir indépendants
financièrement. Il combine budget, épargne, répartition, fonds d'urgence, objectifs,
registre d'assets, simulateur de liberté, bilan hebdomadaire et conseils. L'app travaille
uniquement avec les chiffres saisis : pas d'import bancaire, pas de portefeuilles multiples,
pas de mouvements de fonds.

PWA mobile d'abord, en français, connectée à Supabase (Auth + Postgres + RLS).

## Stack

| Couche | Choix |
| --- | --- |
| Front | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Données | TanStack Query + `@supabase/supabase-js` |
| Back | Supabase : Postgres, Auth, Row Level Security, fonctions SQL |
| Graphiques | SVG maison (aucune librairie de chart) |
| PWA | `vite-plugin-pwa` (précache, manifest, hors-ligne) |
| Qualité | TypeScript strict, Vitest, tests RLS automatisés |

## Démarrage

```bash
npm install
cp .env.example .env   # puis renseigne tes valeurs
npm run dev
```

Variables attendues :

| Variable | Portée | Rôle |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | client | URL du projet Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client | clé publiable (aucun secret) |
| `VITE_APP_URL` | client | origine locale / de production |
| `DATABASE_URL` | serveur | connexion Postgres pour les migrations |
| `SUPABASE_SECRET_KEY` | serveur | scripts d'administration et tests RLS |
| `VITE_VAPID_PUBLIC_KEY` | client | clé publique Web Push (facultative en local) |

Secrets de la fonction `notify` (à poser dans Supabase, jamais dans `.env` versionné) :
`RESEND_API_KEY`, `RESEND_FROM`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
`APP_ORIGIN`.

`.env` est ignoré par Git. **La clé secrète ne doit jamais être exposée au client** :
seule la clé publiable est utilisée dans l'application, et la sécurité repose sur la RLS.

## Base de données

Le schéma complet est dans `supabase/migrations/0001_init.sql` : types, tables, index,
politiques RLS, déclencheurs, vue `monthly_summary` et fonctions. `0003_needs_breakdown.sql`
ajoute `profiles.needs_breakdown`, le détail des besoins saisi à l'inscription.
`0004_v1_1.sql` ajoute les revenus qualifiés (`income_kind`), les objectifs pilotés, le suivi
des défis, les réglages de rappels et la table `push_subscriptions` (RLS incluse).

```bash
npm run db:migrate          # schéma
npm run db:seed             # schéma + 39 conseils et 3 défis
npm run test:rls            # 28 assertions d'isolation entre deux comptes
```

À la création d'un compte, un déclencheur crée automatiquement le profil, la répartition,
le fonds d'urgence, les réglages de notification, les catégories par défaut et la
check-list de protection.

Les calculs (section 6 du cahier des charges) sont centralisés dans `src/lib/calc.ts` :

```
épargne        = max(0, revenus − besoins)
taux           = épargne / revenus
poche          = épargne × pourcentage / 100
cible urgence  = besoins × mois d'urgence
capital liberté = besoins × 12 × 25
capital(n)     = capital × (1 + rendement/1200) + versement
revenu passif  = capital × 0,04 / 12
```

## Fonctionnalités livrées (MVP)

- **Compte & onboarding** : e-mail + mot de passe, lien magique, onboarding en 7 étapes.
  Les besoins ne sont pas demandés en bloc : transport (par jour ou par mois) et alimentation
  (montant par jour × jours par mois) sont calculés en direct, puis logement, factures et
  autres besoins s'ajoutent. Le récapitulatif détaille chaque poste avant d'enregistrer
  l'épargne estimée. Le détail est conservé dans `profiles.needs_breakdown` et affiché dans
  les paramètres.
- **Transactions** : revenus/dépenses, catégories besoin/envie, notes, récurrence
  hebdomadaire ou mensuelle générée par la base, filtres par mois et par type. Un revenu est
  qualifié **fixe / variable / ponctuel** ; pour les revenus variables, l'app affiche une base
  de calcul en **médiane** des mois complets, jamais le meilleur mois.
- **Épargne** : épargne et taux du mois, objectif modifiable, coaching contextuel,
  alerte de dépassement, historique 12 mois.
- **Répartition** : trois poches, présets Prudent/Équilibré/Ambitieux, montants calculés,
  total toujours à 100 % (contrainte en base).
- **Fonds d'urgence & protection** : cible en mois de besoins, suivi du montant, mois
  restants, check-list en 5 points.
- **Assets** : valeur, revenu mensuel, part des besoins couverts, capital de liberté.
- **Simulateur** : besoins, versement, rendement (2–15 %), horizon (1–40 ans), capital de
  départ, courbe, scénarios enregistrés et comparaison A/B.
- **Coach déterministe** : une seule « prochaine action utile » sur le tableau de bord,
  choisie par priorités (saisie manquante, dépassement, fonds d'urgence, objectif de taux,
  objectif absent, assets). Aucun appel d'IA, donc aucun coût et des conseils vérifiables.
- **Bilan de la semaine** : gagné, dépensé, gardé, comparaison avec la semaine précédente
  et catégorie la plus lourde.
- **Objectifs** : création, poche, date cible, versement, progression, suppression.
- **Défis** : lancer un défi, suivre le jour en cours, marquer terminé, abandonner.
- **Conseils** : 39 fiches Épargner/Investir/Protéger/Mentalité, recherche, filtres,
  marquer comme lu, favoris, conseil du jour contextuel.
- **Paramètres** : profil, devise, revenus et besoins courants (avec le détail de
  l'estimation d'inscription), objectif de taux, mois d'urgence, rappels (dont bilan
  hebdomadaire et résumé mensuel), heure des rappels, export CSV/JSON, suppression complète
  du compte.
- **Notifications** : abonnement Web Push depuis les paramètres (service worker), stocké dans
  `push_subscriptions`. L'envoi serveur est écrit mais pas déployé : voir « Notifications
  serveur » ci-dessous.
- **Compte** : inscription réservée aux **18 ans et plus**, consentement explicite sur les
  données financières.
- **PWA** : installable, précache des assets, saisie de transactions hors-ligne avec file
  d'attente et synchronisation au retour du réseau.

## Structure

```
src/
  components/    AppShell, TransactionSheet, bibliothèque UI
  lib/           auth, queries, calc, format, offline, icons, supabase
  pages/         Auth, Onboarding, Home, Save, Invest, Freedom, Tips, Settings
supabase/
  migrations/    schéma + RLS
  seed/          conseils et défis
scripts/         db-migrate, test-rls, seed-demo, gen-icons
```

## Compte de démonstration

```
demo@libre.app / Libre2026!
```

Données réalistes sur cinq mois (compte de test, supprimable depuis Paramètres).

## Sécurité

- RLS activée sur toutes les tables, policies `auth.uid() = user_id` (profils :
  `auth.uid() = id`).
- Catégories : lecture des catégories globales ou des siennes, écriture des siennes.
- Conseils et défis : lecture pour les utilisateurs connectés, écriture réservée au rôle
  service.
- Aucune clé de service dans le bundle client.
- `delete_my_account()` supprime l'utilisateur `auth.users` ; le reste suit en cascade.
- Les tests `npm run test:rls` créent deux comptes réels et prouvent qu'aucune lecture,
  écriture ou suppression croisée n'est possible.

## Documentation produit

- [`docs/CAHIER-DES-CHARGES-V2.md`](docs/CAHIER-DES-CHARGES-V2.md) : cahier des charges
  V2 (modules cibles, migrations internationales, dettes, coach déterministe, offres,
  feuille de route et critères de sortie).

## Notifications serveur (non déployées)

Le client est prêt : `src/lib/push.ts` enregistre l'abonnement de l'appareil dans
`push_subscriptions`, `public/push-handler.js` affiche la notification et ouvre l'app au clic.
L'envoi est écrit dans `supabase/functions/notify/index.ts` (bilan hebdomadaire le lundi,
résumé mensuel le 1er) mais **n'a pas été déployé ni testé** : il demande le CLI Supabase, un
domaine Resend vérifié et une paire de clés VAPID.

```bash
# 1. secrets (une fois)
supabase secrets set RESEND_API_KEY=… RESEND_FROM="Libre <bonjour@ton-domaine>" \
  VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT="mailto:bonjour@ton-domaine" \
  APP_ORIGIN=https://ton-origine
# 2. déploiement
supabase functions deploy notify
# 3. planification (pg_cron ou scheduler)
#    weekly  : lundi 07:00  → {"kind":"weekly"}
#    monthly : 1er du mois   → {"kind":"monthly"}
```

Tant que cette configuration manque, l'app le dit dans les paramètres : les réglages sont
enregistrés, mais rien n'est envoyé.

## Limites connues

- **Envoi des rappels** : dépend de la fonction `notify` ci-dessus (non déployée).
- **Coach IA** : volontairement absent (budget 0). Le coach est un moteur de règles.
- **Import SMS / bancaire** : hors périmètre par décision. L'app ne fonctionne qu'avec les
  chiffres saisis, et ne détient ni ne déplace aucun fonds.
- **Pays et devises** : la devise est modifiable, mais la table `countries`, les formats
  localisés et les contenus par marché restent à faire (migration `0005` du cahier
des charges).
- Le mode clair et l'anglais ne sont pas encore activés.

## Vérifications

```bash
npx tsc --noEmit     # types
npx vitest run       # 47 tests de calcul
npm run test:rls     # isolation RLS
npm run build        # build de production
```
