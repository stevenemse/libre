import type { Debt } from './types';

const clean = (value: string | null | undefined): string =>
  (value ?? '').trim().replace(/\s+/g, ' ');

const amount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

/** Clé de comparaison : casse et espaces ignorés, accents conservés. */
export const normalizeCounterparty = (value: string | null | undefined): string =>
  clean(value).toLowerCase();

/** Noms déjà utilisés pour un sens donné, sans doublons. */
export function debtCounterparties(
  debts: Debt[],
  direction: Debt['direction']
): string[] {
  const names = new Map<string, string>();
  for (const debt of debts) {
    if (debt.direction !== direction) continue;
    const label = clean(debt.counterparty);
    if (!label) continue;
    const key = normalizeCounterparty(label);
    if (!names.has(key)) names.set(key, label);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'fr'));
}

/** Retrouve la dette existante du même prêteur/débiteur, pour la fusionner. */
export function findDebtByCounterparty(
  debts: Debt[],
  direction: Debt['direction'],
  counterparty: string | null | undefined,
  excludeId?: string
): Debt | undefined {
  const key = normalizeCounterparty(counterparty);
  if (!key) return undefined;
  return debts.find(
    (debt) =>
      debt.id !== excludeId &&
      debt.direction === direction &&
      normalizeCounterparty(debt.counterparty) === key
  );
}

export interface DebtMergeInput {
  balance: number;
  monthly_payment: number;
  interest_rate: number | null;
  due_date: string | null;
}

export interface DebtMergedValues {
  balance: number;
  monthly_payment: number;
  interest_rate: number | null;
  due_date: string | null;
}

/**
 * Une nouvelle dette avec le même prêteur/débiteur complète la dette existante :
 * les soldes et mensualités s'additionnent, le taux devient une moyenne pondérée
 * et la première échéance est conservée.
 */
export function mergeDebtValues(
  existing: Debt,
  incoming: DebtMergeInput
): DebtMergedValues {
  const existingBalance = amount(existing.balance);
  const incomingBalance = amount(incoming.balance);
  const totalBalance = existingBalance + incomingBalance;
  const existingRate = existing.interest_rate != null ? amount(existing.interest_rate) : null;
  const incomingRate = incoming.interest_rate != null ? amount(incoming.interest_rate) : null;

  const interestRate =
    existingRate != null && incomingRate != null && totalBalance > 0
      ? Math.round(
          ((existingBalance * existingRate + incomingBalance * incomingRate) / totalBalance) * 100
        ) / 100
      : (incomingRate ?? existingRate);

  const dueDates = [existing.due_date, incoming.due_date]
    .filter((date): date is string => Boolean(date))
    .sort();

  return {
    balance: totalBalance,
    monthly_payment: amount(existing.monthly_payment) + amount(incoming.monthly_payment),
    interest_rate: interestRate,
    due_date: dueDates[0] ?? null,
  };
}
