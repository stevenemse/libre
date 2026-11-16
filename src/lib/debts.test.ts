import { describe, expect, it } from 'vitest';
import {
  debtCounterparties,
  findDebtByCounterparty,
  mergeDebtValues,
  normalizeCounterparty,
} from './debts';
import type { Debt } from './types';

const debt = (patch: Partial<Debt> = {}): Debt => ({
  id: 'debt-1',
  user_id: 'user-1',
  title: 'Crédit',
  direction: 'owed_by_me',
  counterparty: null,
  balance: 0,
  monthly_payment: 0,
  interest_rate: null,
  due_date: null,
  created_at: '',
  ...patch,
});

describe('prêteurs et débiteurs', () => {
  it('normalise la casse et les espaces', () => {
    expect(normalizeCounterparty('  Banque   X ')).toBe('banque x');
    expect(normalizeCounterparty(null)).toBe('');
  });

  it('liste les noms uniques du bon sens, sans doublon', () => {
    const debts = [
      debt({ counterparty: ' Banque  X ' }),
      debt({ counterparty: 'banque x' }),
      debt({ counterparty: 'Jean', direction: 'owed_to_me' }),
      debt({ counterparty: null }),
    ];

    expect(debtCounterparties(debts, 'owed_by_me')).toEqual(['Banque X']);
    expect(debtCounterparties(debts, 'owed_to_me')).toEqual(['Jean']);
  });

  it('retrouve une dette existante par nom, sans mélanger les sens', () => {
    const lender = debt({ id: 'lender', counterparty: 'Jean' });
    const borrower = debt({ id: 'borrower', counterparty: 'jean', direction: 'owed_to_me' });

    expect(findDebtByCounterparty([lender, borrower], 'owed_by_me', ' JEAN ')).toBe(lender);
    expect(findDebtByCounterparty([lender, borrower], 'owed_to_me', 'jean')).toBe(borrower);
    expect(findDebtByCounterparty([lender], 'owed_by_me', 'jean', 'lender')).toBeUndefined();
    expect(findDebtByCounterparty([lender], 'owed_by_me', '')).toBeUndefined();
  });
});

describe('fusion de dettes', () => {
  it('additionne soldes et mensualités, moyenne les taux et garde la première échéance', () => {
    const existing = debt({
      balance: 100_000,
      monthly_payment: 10_000,
      interest_rate: 10,
      due_date: '2027-06-01',
    });

    expect(
      mergeDebtValues(existing, {
        balance: 50_000,
        monthly_payment: 5_000,
        interest_rate: 0,
        due_date: '2027-01-01',
      })
    ).toEqual({
      balance: 150_000,
      monthly_payment: 15_000,
      interest_rate: 6.67,
      due_date: '2027-01-01',
    });
  });

  it('garde le taux renseigné quand l’autre est absent', () => {
    expect(
      mergeDebtValues(debt({ interest_rate: null }), {
        balance: 10_000,
        monthly_payment: 1_000,
        interest_rate: 5,
        due_date: null,
      }).interest_rate
    ).toBe(5);

    expect(
      mergeDebtValues(debt({ interest_rate: 5 }), {
        balance: 10_000,
        monthly_payment: 1_000,
        interest_rate: null,
        due_date: null,
      }).interest_rate
    ).toBe(5);
  });
});
