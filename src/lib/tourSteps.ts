/**
 * Étapes de la visite guidée.
 *
 * Chaque étape peut changer d'écran (`route`) et pointer un élément (`target`).
 * Les sélecteurs utilisent des attributs `data-tour` pour rester stables et
 * fonctionner aussi bien sur ordinateur (navigation en haut) que sur mobile
 * (barre du bas), où plusieurs éléments portent le même attribut : le guide
 * choisit le premier visible.
 */
export interface TourStep {
  id: string;
  route?: string;
  target?: string;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Bienvenue dans Libre',
    body: "Quelques secondes pour repérer l'essentiel. Tu pourras revoir ce guide depuis les paramètres, quand tu veux.",
  },
  {
    id: 'next-action',
    route: '/',
    target: '[data-tour="next-action"]',
    title: 'Ta prochaine action',
    body: 'À chaque ouverture, Libre te propose une seule chose à faire, choisie à partir de tes chiffres. Pas de liste interminable : la priorité du moment.',
  },
  {
    id: 'month-card',
    route: '/',
    target: '[data-tour="month-card"]',
    title: "L'épargne du mois",
    body: 'Revenus moins besoins courants, et ton taux face à l’objectif que tu as fixé. C’est ton chiffre de référence, recalculé à chaque saisie.',
  },
  {
    id: 'weekly',
    route: '/',
    target: '[data-tour="weekly"]',
    title: 'Le bilan de la semaine',
    body: 'Gagné, dépensé, gardé, comparé à la semaine précédente. La catégorie la plus lourde est nommée pour que tu saches où regarder.',
  },
  {
    id: 'add',
    route: '/',
    target: '[data-tour="add"]',
    title: 'Noter une dépense ou un revenu',
    body: 'Deux taps suffisent. Un revenu se qualifie fixe, variable ou ponctuel : Libre calcule ta base sur la médiane de tes revenus variables, jamais sur ton meilleur mois.',
  },
  {
    id: 'goals',
    route: '/epargner',
    target: '[data-tour="goals"]',
    title: 'Tes objectifs',
    body: 'Nomme un projet, donne un montant cible, verse quand tu peux. La progression suit toute seule et l’objectif reste visible dans ta prochaine action.',
  },
  {
    id: 'debts',
    route: '/epargner',
    target: '[data-tour="debts"]',
    title: 'Dettes et créances',
    body: 'Déclare ce que tu dois et ce qu’on te doit. Les mensualités réduisent ta marge du mois et comptent dans ton fonds d’urgence et ton capital de liberté ; le solde restant donne ton patrimoine net.',
  },
  {
    id: 'assets',
    route: '/investir',
    target: '[data-tour="assets"]',
    title: 'La répartition',
    body: 'Trois poches : subsistance, assets, protection. Ton épargne du mois se répartit à 100 %, et tu ajustes chaque part.',
  },
  {
    id: 'simulator',
    route: '/liberte',
    target: '[data-tour="simulator"]',
    title: 'Ton horizon de liberté',
    body: 'Bouge les curseurs : besoins, versement, rendement. Libre calcule le capital nécessaire et le temps qu’il te reste. Les rendements affichés sont des hypothèses, pas des promesses.',
  },
  {
    id: 'challenges',
    route: '/conseils',
    target: '[data-tour="challenges"]',
    title: 'Conseils et défis',
    body: 'Des fiches de deux minutes pour apprendre, et des défis à tenir sur quelques jours. Un défi à la fois, avec le jour en cours.',
  },
  {
    id: 'notifications',
    route: '/parametres',
    target: '[data-tour="notifications"]',
    title: 'Tes rappels',
    body: 'Choisis ce que tu reçois et à quelle heure. Plus bas : l’export de tes données et la suppression complète du compte.',
  },
  {
    id: 'end',
    title: 'C’est tout',
    body: 'Tu peux revoir ce guide depuis les paramètres. Sur téléphone, ajoute Libre à ton écran d’accueil pour l’ouvrir comme une application.',
  },
];
