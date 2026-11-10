import type { Allocation, MonthSummary, Transaction } from './types';

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
