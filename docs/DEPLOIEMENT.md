# Déployer Libre sur Vercel

Libre est un **SPA statique** : `npm run build` produit un dossier `dist/` sans serveur applicatif.
Les données vivent dans Supabase, qui est déjà en production. Il n'y a donc rien d'autre à
héberger que ces fichiers.

Le fichier [`vercel.json`](../vercel.json) à la racine s'occupe de tout ce qui n'est pas
déductible du code : réécriture vers `index.html`, cache du service worker et des assets.

---

## 1. Variables d'environnement

Trois variables sont nécessaires côté client. Elles sont **publiques par nature** : Vite les
insère en clair dans le bundle au moment du build. C'est sans risque, la sécurité des données
repose sur la RLS de Supabase, pas sur le secret de ces valeurs.

| Variable | Obligatoire | Valeur | Où la trouver |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | oui | `https://<projet>.supabase.co` | Supabase → Project Settings → API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | oui | `sb_publishable_…` | Supabase → Project Settings → API Keys |
| `VITE_VAPID_PUBLIC_KEY` | non | clé publique VAPID | générée avec la paire VAPID (voir README) |

À poser dans **Vercel → Project → Settings → Environment Variables**, en cochant les
environnements voulus (Production, Preview). Le dépôt étant public, aucun secret ne peut de
toute façon y être committé.

### Deux variables à ne jamais mettre sur Vercel

`DATABASE_URL` et `SUPABASE_SECRET_KEY` servent uniquement aux scripts locaux (migrations,
seed, tests RLS). La seconde contourne la RLS : la placer dans un hébergeur public, c'est
donner les clés de toute la base à qui sait lire une variable d'environnement.

Les secrets de la fonction `notify` (`RESEND_API_KEY`, `VAPID_PRIVATE_KEY`, …) vont dans
**Supabase → Edge Functions → Secrets**, jamais sur Vercel.

### Les valeurs sont figées au build

Vite remplace `import.meta.env.VITE_*` à la compilation. Ajouter ou modifier une variable
après un déploiement ne change **rien** tant qu'aucun nouveau build n'a été lancé :
utilise « Redeploy » (sans cache) après toute modification.

---

## 2. Importer le projet

1. Sur [vercel.com/new](https://vercel.com/new), importe le dépôt GitHub `stevenemse/libre`.
2. Laisse le **Root Directory** à la racine.
3. Le preset **Vite** est détecté ; les commandes sont déjà dans `vercel.json`
   (`npm ci`, `npm run build`, sortie `dist`) — ne les remplace pas par autre chose.
4. Ajoute les variables de la section 1 **avant** de cliquer sur Deploy, sinon le premier
   build partira sans Supabase et l'app affichera une erreur de configuration.
5. Déploie.

Il n'y a ni fonction serverless ni build step supplémentaire à déclarer.

---

## 3. Réécriture SPA

Sans elle, `https://<domaine>/liberte` renvoie une 404 : Vercel cherche un fichier
`liberte.html` qui n'existe pas. La règle de `vercel.json` renvoie toutes les URLs vers
`index.html`, et React Router affiche le bon écran.

```json
"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
```

Vercel donne **priorité au système de fichiers** avant d'appliquer une réécriture : `/assets/*`,
`/sw.js`, `/manifest.webmanifest` et les icônes continuent donc d'être servis normalement.

Les en-têtes associés évitent deux pièges classiques :

- `sw.js` et `push-handler.js` en `max-age=0, must-revalidate` — un service worker mis en
  cache trop longtemps empêche les mises à jour de l'app de se propager.
- `/assets/*` en `immutable, max-age=31536000` — ces fichiers portent un hash dans leur nom,
  ils peuvent être cachés indéfiniment.

Une CSP stricte n'est pas posée pour l'instant : l'app charge la police Urbanist depuis
Google Fonts et utilise des styles inline. À traiter séparément si tu veux durcir ce point.

---

## 4. Autoriser le domaine dans Supabase

L'app demande ses liens e-mail avec `window.location.origin` (confirmation d'inscription,
lien magique). Si l'origine déployée n'est pas autorisée côté Supabase, le lien renvoie vers
l'ancienne adresse — souvent `localhost:5173` — et la connexion échoue.

Dans **Supabase → Authentication → URL Configuration** :

- **Site URL** : `https://<ton-domaine>` (le domaine de production, sans slash final).
- **Redirect URLs** : ajoute `https://<ton-domaine>/**`.
  Garde `http://localhost:5173/**` pour le développement local.
  Si tu veux tester les liens e-mail depuis les Preview Deployments, ajoute aussi
  `https://*-<ton-scope>.vercel.app/**` ; sinon laisse-les de côté, ils changeront à chaque push.

Aucune clé supplémentaire n'est nécessaire : la clé publiable suffit, il n'y a pas de secret
côté client.

---

## 5. HTTPS et PWA

Les domaines `*.vercel.app` sont servis en HTTPS, et un domaine personnalisé reçoit son
certificat automatiquement. C'est une condition d'utilisation du service worker et des
notifications push : en HTTP (hors `localhost`), ni l'installation ni le push ne fonctionnent.

Une fois en ligne, l'app est installable depuis le navigateur (menu « Installer » ou
« Ajouter à l'écran d'accueil »).

---

## 6. Vérifier après le déploiement

Le déploiement réussi ne prouve pas que l'app fonctionne. À contrôler, dans cet ordre :

1. La page d'accueil s'affiche et redirige vers `/connexion` sans compte.
2. Connexion avec un compte réel : les chiffres du mois apparaissent.
3. Rafraîchis directement `https://<domaine>/liberte` : la page se recharge au lieu d'une 404
   (c'est le test de la réécriture SPA).
4. Onglet Application des DevTools : le service worker est actif au scope `/`, le manifest est
   lu sans erreur, l'app est proposée à l'installation.
5. Console : aucune erreur, aucun avertissement supabase-js.
6. Parcours inscription : l'e-mail de confirmation pointe bien vers le domaine de production.
7. Vérifie que le HTML livré contient ton URL Supabase (`Ctrl+F` sur `supabase.co` dans le
   source), preuve que les variables ont bien été prises au build.

---

## 7. Ce qui ne fonctionnera pas encore

Les **rappels e-mail et push** restent inactifs : la fonction Edge `notify` n'est pas déployée
et les secrets Resend / VAPID ne sont pas posés. Le bouton des paramètres affiche son message
« non configuré » ; c'est attendu et le reste de l'app n'en dépend pas (voir README,
section « Notifications serveur »).

---

## 8. Revenir en arrière

Vercel conserve chaque déploiement : **Deployments → … → Promote to Production** pour
revenir à une version précédente en quelques secondes. Un `git revert` suivi d'un push
fonctionne aussi, puisque chaque push sur `main` déclenche un nouveau déploiement de production.
