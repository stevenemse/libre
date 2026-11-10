import type {
  Allocation,
  MonthSummary,
  NeedsBreakdown,
  NextAction,
  RecurringNeed,
  Transaction,
  WeeklyReview,
} from './types';

export const num = (value: unknown): number => {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Épargne = revenus − besoins courants (jamais négative dans l'affichage). */
export function savings(revenue: number, needs: number): number {
  return Math.max(0, revenue - needs);
}

/** Taux d'épargne = épargne ÷ revenus. */
export function savingsRate(revenue: number, needs: number): number {
  if (revenue <= 0) return 0;
  return savings(revenue, needs) / revenue;
}

/** Besoin récurrent mensuel = montant × jours par mois, ou montant mensuel direct. */
export function recurringNeedMonthly(need: RecurringNeed | null | undefined): number {
  if (!need) return 0;
  const amount = Math.max(0, num(need.unitAmount));
  if (need.basis === 'month') return amount;
  return amount * Math.max(0, num(need.days));
}

/** Total des besoins courants à partir du détail saisi (transport, alimentation, logement). */
export function needsBreakdownTotal(breakdown: NeedsBreakdown | null | undefined): number {
  if (!breakdown) return 0;
  const housing = breakdown.housing;
  return (
    recurringNeedMonthly(breakdown.transport) +
    recurringNeedMonthly(breakdown.food) +
    Math.max(0, num(housing?.rent)) +
    Math.max(0, num(housing?.bills)) +
    Math.max(0, num(housing?.other))
  );
}

/** Versement par poche = épargne × pourcentage / 100. */
export function pocketAmounts(savingsAmount: number, allocation: Allocation) {
  return {
    subsistence: (savingsAmount * num(allocation.pct_subsistence)) / 100,
    assets: (savingsAmount * num(allocation.pct_assets)) / 100,
    protection: (savingsAmount * num(allocation.pct_protection)) / 100,
  };
}

/** Cible du fonds d'urgence = besoins du mois × mois d'urgence. */
export function emergencyTarget(monthlyNeeds: number, months: number): number {
  return Math.max(0, monthlyNeeds) * Math.max(1, months);
}

export function monthsToEmergencyFund(
  target: number,
  alreadySaved: number,
  monthlyProtection: number
): number | null {
  const missing = Math.max(0, target - alreadySaved);
  if (missing === 0) return 0;
  if (monthlyProtection <= 0) return null;
  return Math.ceil(missing / monthlyProtection);
}

/** Capital de liberté = besoins mensuels × 12 × 25 (règle des 4 %). */
export function freedomCapital(monthlyNeeds: number): number {
  return Math.max(0, monthlyNeeds) * 12 * 25;
}

/** Revenu passif mensuel = capital × 0,04 / 12. */
export function passiveIncome(capital: number): number {
  return (capital * 0.04) / 12;
}

/** Part des besoins couverts = revenu passif ÷ besoins mensuels. */
export function needsCovered(capital: number, monthlyNeeds: number): number {
  if (monthlyNeeds <= 0) return 0;
  return passiveIncome(capital) / monthlyNeeds;
}

export interface ProjectionInput {
  startCapital: number;
  monthlyContribution: number;
  annualReturn: number; // en pourcentage, 2 à 15
  months: number;
}

/** capital(n) = capital × (1 + i) + versement, avec i = rendement / 1200. */
export function projectCapital({
  startCapital,
  monthlyContribution,
  annualReturn,
  months,
}: ProjectionInput): number {
  const i = annualReturn / 1200;
  let capital = Math.max(0, startCapital);
  for (let m = 0; m < months; m += 1) {
    capital = capital * (1 + i) + Math.max(0, monthlyContribution);
  }
  return capital;
}

/** Série mensuelle de croissance pour la courbe. */
export function projectionSeries(input: ProjectionInput): number[] {
  const i = input.annualReturn / 1200;
  let capital = Math.max(0, input.startCapital);
  const series = [capital];
  for (let m = 0; m < input.months; m += 1) {
    capital = capital * (1 + i) + Math.max(0, input.monthlyContribution);
    series.push(capital);
  }
  return series;
}

/** Nombre de mois avant que le capital atteigne la cible (null si hors horizon). */
export function monthsToFreedom(
  startCapital: number,
  monthlyContribution: number,
  annualReturn: number,
  target: number,
  horizonMonths = 40 * 12
): number | null {
  if (target <= 0) return 0;
  const i = annualReturn / 1200;
  let capital = Math.max(0, startCapital);
  if (capital >= target) return 0;
  if (monthlyContribution <= 0 && i <= 0) return null;
  for (let m = 1; m <= horizonMonths; m += 1) {
    capital = capital * (1 + i) + Math.max(0, monthlyContribution);
    if (capital >= target) return m;
  }
  return null;
}

/** Nombre de mois avant que le revenu passif couvre 100 % des besoins. */
export function monthsToCoverNeeds(
  startCapital: number,
  monthlyContribution: number,
  annualReturn: number,
  monthlyNeeds: number
): number | null {
  return monthsToFreedom(
    startCapital,
    monthlyContribution,
    annualReturn,
    freedomCapital(monthlyNeeds)
  );
}

/** Découpe les transactions en synthèses mensuelles (12 derniers mois). */
export function monthlySummaries(
  transactions: Transaction[],
  categoryKinds: Map<string, 'need' | 'want' | null>,
  fallback: { income: number; needs: number },
  monthsBack = 12,
  now = new Date()
): MonthSummary[] {
  const buckets = new Map<string, MonthSummary>();
  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, { month: key, income: 0, needs: 0, wants: 0, savings: 0 });
  }
  for (const tx of transactions) {
    const key = tx.occurred_on.slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const amount = num(tx.amount);
    if (tx.type === 'income') {
      bucket.income += amount;
    } else {
      const kind = tx.category_id ? categoryKinds.get(tx.category_id) : null;
      if (kind === 'need') bucket.needs += amount;
      else if (kind === 'want') bucket.wants += amount;
    }
  }
  const list = [...buckets.values()];
  // Si aucune transaction n'existe, utiliser les moyennes de l'onboarding
  if (transactions.length === 0) {
    return list.map((m) => ({
      ...m,
      income: fallback.income,
      needs: fallback.needs,
      savings: savings(fallback.income, fallback.needs),
    }));
  }
  return list.map((m) => ({ ...m, savings: savings(m.income, m.needs) }));
}

export const currentMonthKey = (now = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

export const monthLabel = (key: string): string => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    .replace(/^./, (c) => c.toUpperCase());
};

export const shortMonthLabel = (key: string): string => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'short' });
};

/* ------------------------------------------------------------- Revenus irréguliers */

/**
 * Base de calcul des revenus variables : médiane des mois complets qui ont
 * porté au moins un revenu. Un mois sans revenu n'écrase pas la médiane,
 * contrairement à une moyenne qui la tirerait vers zéro.
 */
export function incomeMedian(
  transactions: Transaction[],
  monthsBack = 3,
  now = new Date()
): { median: number; months: number } {
  const keys: string[] = [];
  for (let i = 1; i <= monthsBack; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const totals = new Map<string, number>(keys.map((key) => [key, 0]));
  for (const tx of transactions) {
    if (tx.type !== 'income') continue;
    const key = tx.occurred_on.slice(0, 7);
    if (!totals.has(key)) continue;
    totals.set(key, (totals.get(key) ?? 0) + num(tx.amount));
  }
  const values = [...totals.values()].filter((value) => value > 0).sort((a, b) => a - b);
  if (values.length === 0) return { median: 0, months: 0 };
  const middle = Math.floor(values.length / 2);
  const median =
    values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle];
  return { median: round2(median), months: values.length };
}

/* ------------------------------------------------------------------ Bilan hebdo */

const isoDay = (date: Date): string => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

/** Lundi de la semaine contenant `now`. */
export function weekStart(now = new Date()): Date {
  const day = now.getDay(); // 0 = dimanche
  const offset = day === 0 ? 6 : day - 1;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
}

/**
 * Bilan de la semaine en cours, comparé à la semaine précédente.
 * Les dépenses comptent ici toutes les sorties, besoins comme envies.
 */
export function weeklyReview(
  transactions: Transaction[],
  categoryNames: Map<string, string>,
  now = new Date()
): WeeklyReview {
  const start = weekStart(now);
  const previousStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7);
  const from = isoDay(start);
  const to = isoDay(now);
  const previousFrom = isoDay(previousStart);

  let income = 0;
  let expenses = 0;
  let previousSaved = 0;
  let previousIncome = 0;
  let previousExpenses = 0;
  const byCategory = new Map<string, number>();

  for (const tx of transactions) {
    const day = tx.occurred_on.slice(0, 10);
    const amount = num(tx.amount);
    const inCurrent = day >= from && day <= to;
    const inPrevious = day >= previousFrom && day < from;
    if (!inCurrent && !inPrevious) continue;
    if (tx.type === 'income') {
      if (inCurrent) income += amount;
      else previousIncome += amount;
      continue;
    }
    if (inCurrent) {
      expenses += amount;
      const name = (tx.category_id ? categoryNames.get(tx.category_id) : null) ?? 'Sans catégorie';
      byCategory.set(name, (byCategory.get(name) ?? 0) + amount);
    } else {
      previousExpenses += amount;
    }
  }

  previousSaved = savings(previousIncome, previousExpenses);
  const saved = savings(income, expenses);
  const hadPrevious = previousIncome > 0 || previousExpenses > 0;
  const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    from,
    to,
    income: round2(income),
    expenses: round2(expenses),
    saved: round2(saved),
    previousSaved: round2(previousSaved),
    change: hadPrevious ? round2(saved - previousSaved) : null,
    topCategory: top ? { name: top[0], amount: round2(top[1]) } : null,
  };
}

/* ------------------------------------------------- Prochaine action utile (coach) */

export interface NextActionInput {
  onboarded: boolean;
  transactionCount: number;
  monthIncome: number;
  monthExpenses: number;
  savingsRate: number;
  goalRate: number;
  emergencySaved: number;
  emergencyTarget: number;
  coverage: number;
  activeGoals: number;
}

/**
 * Une seule action à la fois, choisie par la règle la plus prioritaire.
 * Aucune IA : le même état donne toujours la même recommandation.
 */
export function nextAction(input: NextActionInput): NextAction {
  if (!input.onboarded) {
    return {
      key: 'onboarding',
      tone: 'neutral',
      title: 'Termine ton estimation',
      body: "Trois minutes pour que Libre connaisse tes revenus et tes besoins réels.",
      cta: { label: 'Continuer', to: '/onboarding' },
    };
  }
  if (input.transactionCount === 0) {
    return {
      key: 'first-transaction',
      tone: 'neutral',
      title: 'Note ta première dépense',
      body: 'Dès la première saisie, ton épargne devient réelle au lieu d’être une estimation.',
      cta: { label: 'Ajouter', to: '/epargner' },
    };
  }
  if (input.monthIncome <= 0) {
    return {
      key: 'no-income',
      tone: 'neutral',
      title: 'Ajoute ton revenu du mois',
      body: 'Sans revenu enregistré, Libre ne peut pas calculer ton taux d’épargne.',
      cta: { label: 'Saisir un revenu', to: '/epargner' },
    };
  }
  if (input.monthExpenses > input.monthIncome) {
    return {
      key: 'over-budget',
      tone: 'danger',
      title: 'Tes dépenses dépassent tes revenus',
      body: 'Commence par réduire un besoin récurrent de 10 % : c’est le levier le plus rapide.',
      cta: { label: 'Voir le détail', to: '/epargner' },
    };
  }
  if (input.emergencySaved < input.emergencyTarget) {
    const missing = input.emergencyTarget - input.emergencySaved;
    return {
      key: 'emergency',
      tone: 'warning',
      title: 'Complète ton fonds d’urgence',
      body: `Il manque ${Math.round(missing).toLocaleString('fr-FR')} pour atteindre ton coussin de sécurité.`,
      cta: { label: 'Verser', to: '/investir' },
    };
  }
  if (input.savingsRate < input.goalRate) {
    const points = Math.round((input.goalRate - input.savingsRate) * 100);
    return {
      key: 'rate',
      tone: 'warning',
      title: 'Il te manque ' + points + ' points',
      body: 'Chaque point gagné sur ton taux d’épargne rapproche ta liberté d’un mois.',
      cta: { label: 'Ajuster', to: '/epargner' },
    };
  }
  if (input.activeGoals === 0) {
    return {
      key: 'no-goal',
      tone: 'neutral',
      title: 'Ouvre un objectif',
      body: 'Un fonds, un projet, une formation : un objectif chiffré donne une raison à ton épargne.',
      cta: { label: 'Créer un objectif', to: '/epargner' },
    };
  }
  if (input.coverage < 0.25) {
    return {
      key: 'assets',
      tone: 'neutral',
      title: 'Fais travailler ton épargne',
      body: 'Tes assets couvrent moins d’un quart de tes besoins. Ajoute une source de revenu.',
      cta: { label: 'Ajouter un asset', to: '/investir' },
    };
  }
  return {
    key: 'on-track',
    tone: 'positive',
    title: 'Tu es sur la bonne trajectoire',
    body: 'Continue à verser chaque mois et vérifie ton horizon dans le simulateur.',
    cta: { label: 'Voir mon horizon', to: '/liberte' },
  };
}

/** Progression d'un objectif, entre 0 et 1. */
export function goalProgress(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(1, num(current) / target));
}

export interface CoachMessage {
  tone: 'danger' | 'warning' | 'neutral' | 'positive';
  title: string;
  body: string;
}

/** Message de coaching selon le taux d'épargne. */
export function coachMessage(
  revenue: number,
  needs: number,
  rate: number,
  goalPct = 20
): CoachMessage {
  if (revenue > 0 && needs > revenue) {
    return {
      tone: 'danger',
      title: 'Tes besoins dépassent tes revenus',
      body: "Ce mois-ci, tu dépenses plus que tu ne gagnes. Commence par un besoin à réduire de 10 % avant d'ajouter une envie.",
    };
  }
  if (revenue === 0) {
    return {
      tone: 'neutral',
      title: 'Ajoute tes premiers revenus',
      body: 'Dès que tu enregistres un revenu et une dépense, Libre calcule ton épargne réelle.',
    };
  }
  if (rate <= 0) {
    return {
      tone: 'danger',
      title: 'Aucune épargne ce mois-ci',
      body: 'Tes revenus couvrent tout juste tes besoins. Mets de côté une petite somme dès la prochaine paie, même 1 000 FCFA.',
    };
  }
  if (rate < 0.1) {
    return {
      tone: 'warning',
      title: 'Tu épargnes moins de 10 %',
      body: 'Un bon début. Vise 10 % en réduisant un besoin récurrent, puis 20 % sans changer ton niveau de vie.',
    };
  }
  if (rate < goalPct / 100) {
    return {
      tone: 'neutral',
      title: "Tu approches de l'objectif",
      body: `Tu es à ${Math.round(rate * 100)} %. Chaque point gagné rapproche ta liberté. Continue sur cette lancée.`,
    };
  }
  return {
    tone: 'positive',
    title: 'Objectif atteint, bravo',
    body: "Ton taux d'épargne dépasse ton objectif. Oriente cette épargne vers des assets pour qu'elle travaille pour toi.",
  };
}
