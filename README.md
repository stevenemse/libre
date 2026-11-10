# Libre

**Richesse = liberté.**

Libre est un compagnon financier pour les jeunes de 16 à 35 ans qui veulent devenir
indépendants financièrement. Il combine budget, épargne, répartition, fonds d'urgence,
registre d'assets, simulateur de liberté et conseils.

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

`.env` est ignoré par Git. **La clé secrète ne doit jamais être exposée au client** :
seule la clé publiable est utilisée dans l'application, et la sécurité repose sur la RLS.

## Base de données

Le schéma complet est dans `supabase/migrations/0001_init.sql` : types, tables, index,
politiques RLS, déclencheurs, vue `monthly_summary` et fonctions. `0003_needs_breakdown.sql`
ajoute `profiles.needs_breakdown`, le détail des besoins saisi à l'inscription.

```bash
npm run db:migrate          # schéma
npm run db:seed             # schéma + 39 conseils et 3 défis
npm run test:rls            # 21 assertions d'isolation entre deux comptes
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
  hebdomadaire ou mensuelle générée par la base, filtres par mois et par type.
- **Épargne** : épargne et taux du mois, objectif modifiable, coaching contextuel,
  alerte de dépassement, historique 12 mois.
- **Répartition** : trois poches, présets Prudent/Équilibré/Ambitieux, montants calculés,
  total toujours à 100 % (contrainte en base).
- **Fonds d'urgence & protection** : cible en mois de besoins, suivi du montant, mois
  restants, check-list en 5 points.
- **Assets** : valeur, revenu mensuel, part des besoins couverts, capital de liberté.
- **Simulateur** : besoins, versement, rendement (2–15 %), horizon (1–40 ans), capital de
  départ, courbe, scénarios enregistrés et comparaison A/B.
- **Conseils** : 39 fiches Épargner/Investir/Protéger/Mentalité, recherche, filtres,
  marquer comme lu, favoris, conseil du jour contextuel.
- **Paramètres** : profil, devise, revenus et besoins courants (avec le détail de
  l'estimation d'inscription), objectif de taux, mois d'urgence, notifications, export
  CSV/JSON, suppression complète du compte.
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
  V2 (modules cibles, migrations internationales, portefeuilles, dettes, coach, offres,
  feuille de route et critères de sortie).

## Limites connues

- **Notifications push et e-mail** : les réglages sont enregistrés et l'autorisation
  navigateur est demandée, mais l'envoi planifié (Web Push + Resend) nécessite des Edge
  Functions déployées et un projet Resend — non inclus dans cette livraison.
- **Résumé mensuel automatique** : même dépendance à une tâche planifiée serveur.
- **v1.1** : objectifs d'épargne multiples, défis, séries de jours et import SMS Mobile
  Money ne sont pas exposés dans l'interface (les tables `goals`, `challenges`,
  `user_challenges` existent déjà).
- Le mode clair et l'anglais ne sont pas encore activés.

## Vérifications

```bash
npx tsc --noEmit     # types
npx vitest run       # 31 tests de calcul
npm run test:rls     # isolation RLS
npm run build        # build de production
```
