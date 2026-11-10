import { describe, expect, it } from 'vitest';
import {
  coachMessage,
  emergencyTarget,
  freedomCapital,
  goalProgress,
  incomeMedian,
  nextAction,
  weeklyReview,
  monthlySummaries,
  monthsToCoverNeeds,
  monthsToEmergencyFund,
  monthsToFreedom,
  needsCovered,
  passiveIncome,
  needsBreakdownTotal,
  pocketAmounts,
  projectCapital,
  recurringNeedMonthly,
  savings,
  savingsRate,
} from './calc';
import type { Allocation, Transaction } from './types';

const tx = (patch: Partial<Transaction> & Pick<Transaction, 'occurred_on' | 'amount'>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  user_id: 'u',
  category_id: null,
  type: 'expense',
  note: null,
  recurrence: 'none',
  parent_tx_id: null,
  income_kind: null,
  created_at: '',
  ...patch,
});

const allocation: Allocation = {
  user_id: 'u1',
  pct_subsistence: 25,
  pct_assets: 50,
  pct_protection: 25,
  updated_at: '',
};

describe('épargne et taux', () => {
  it('épargne = revenus − besoins courants', () => {
    expect(savings(250_000, 160_000)).toBe(90_000);
  });

  it('ne renvoie jamais une épargne négative', () => {
    expect(savings(100_000, 140_000)).toBe(0);
  });

  it('taux = épargne ÷ revenus', () => {
    expect(savingsRate(250_000, 150_000)).toBeCloseTo(0.4, 10);
  });

  it('taux nul sans revenus', () => {
    expect(savingsRate(0, 50_000)).toBe(0);
  });
});

describe('répartition par poche', () => {
  it('applique chaque pourcentage à l’épargne', () => {
    const amounts = pocketAmounts(100_000, allocation);
    expect(amounts.subsistence).toBe(25_000);
    expect(amounts.assets).toBe(50_000);
    expect(amounts.protection).toBe(25_000);
  });

  it('total toujours égal à l’épargne', () => {
    const amounts = pocketAmounts(87_500, { ...allocation, pct_subsistence: 15, pct_assets: 70, pct_protection: 15 });
    const total = amounts.subsistence + amounts.assets + amounts.protection;
    expect(Math.round(total)).toBe(87_500);
  });
});

describe('fonds d’urgence', () => {
  it('cible = besoins × mois', () => {
    expect(emergencyTarget(120_000, 6)).toBe(720_000);
  });

  it('mois restants arrondis au supérieur', () => {
    expect(monthsToEmergencyFund(720_000, 300_000, 25_000)).toBe(17);
  });

  it('zéro mois quand la cible est atteinte', () => {
    expect(monthsToEmergencyFund(720_000, 800_000, 10_000)).toBe(0);
  });

  it('null sans versement possible', () => {
    expect(monthsToEmergencyFund(720_000, 0, 0)).toBeNull();
  });
});

describe('liberté financière (règle des 4 %)', () => {
  it('capital cible = besoins × 12 × 25', () => {
    expect(freedomCapital(100_000)).toBe(30_000_000);
  });

  it('revenu passif = capital × 4 % / 12', () => {
    expect(passiveIncome(30_000_000)).toBe(100_000);
  });

  it('un capital cible couvre 100 % des besoins', () => {
    expect(needsCovered(freedomCapital(100_000), 100_000)).toBe(1);
  });

  it('couverture nulle sans besoins', () => {
    expect(needsCovered(1_000_000, 0)).toBe(0);
  });
});

describe('simulateur', () => {
  it('capital composé mensuel', () => {
    const capital = projectCapital({
      startCapital: 0,
      monthlyContribution: 10_000,
      annualReturn: 12,
      months: 12,
    });
    expect(capital).toBeCloseTo(126_825, 0);
  });

  it('capital constant sans rendement', () => {
    expect(
      projectCapital({ startCapital: 50_000, monthlyContribution: 5_000, annualReturn: 0, months: 10 })
    ).toBe(100_000);
  });

  it('années avant liberté avec rendement nul', () => {
    const months = monthsToFreedom(0, 100_000, 0, 30_000_000);
    expect(months).toBe(300);
    expect(months! / 12).toBe(25);
  });

  it('liberté immédiate si le capital suffit', () => {
    expect(monthsToFreedom(31_000_000, 0, 5, 30_000_000)).toBe(0);
  });

  it('null si le capital cible est hors d’atteinte', () => {
    expect(monthsToFreedom(0, 0, 0, 30_000_000)).toBeNull();
  });

  it('le rendement accélère la liberté', () => {
    const withoutReturn = monthsToCoverNeeds(0, 100_000, 0, 100_000);
    const withReturn = monthsToCoverNeeds(0, 100_000, 8, 100_000);
    expect(withoutReturn).not.toBeNull();
    expect(withReturn).not.toBeNull();
    expect(withReturn!).toBeLessThan(withoutReturn!);
  });
});

describe('synthèse mensuelle', () => {
  const kinds = new Map<string, 'need' | 'want' | null>([
    ['c-need', 'need'],
    ['c-want', 'want'],
  ]);

  it('agrège revenus, besoins et envies par mois', () => {
    const transactions: Transaction[] = [
      {
        id: '1', user_id: 'u', category_id: 'c-need', type: 'income', amount: 300_000,
        occurred_on: '2026-10-02', note: null, recurrence: 'none', parent_tx_id: null, income_kind: null, created_at: '',
      },
      {
        id: '2', user_id: 'u', category_id: 'c-need', type: 'expense', amount: 100_000,
        occurred_on: '2026-10-05', note: null, recurrence: 'none', parent_tx_id: null, income_kind: null, created_at: '',
      },
      {
        id: '3', user_id: 'u', category_id: 'c-want', type: 'expense', amount: 30_000,
        occurred_on: '2026-10-09', note: null, recurrence: 'none', parent_tx_id: null, income_kind: null, created_at: '',
      },
    ];
    const summaries = monthlySummaries(
      transactions,
      kinds,
      { income: 0, needs: 0 },
      1,
      new Date(2026, 9, 15)
    );
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      month: '2026-10',
      income: 300_000,
      needs: 100_000,
      wants: 30_000,
      savings: 200_000,
    });
  });

  it('utilise les moyennes d’onboarding sans transaction', () => {
    const summaries = monthlySummaries([], kinds, { income: 200_000, needs: 120_000 }, 1, new Date(2026, 9, 15));
    expect(summaries[0]).toMatchObject({ income: 200_000, needs: 120_000, savings: 80_000 });
  });
});

describe('besoins détaillés', () => {
  it('calcule un besoin au jour', () => {
    expect(recurringNeedMonthly({ basis: 'day', unitAmount: 500, days: 22 })).toBe(11_000);
  });

  it('garde un montant mensuel tel quel', () => {
    expect(recurringNeedMonthly({ basis: 'month', unitAmount: 40_000, days: 1 })).toBe(40_000);
  });

  it('ignore les valeurs négatives', () => {
    expect(recurringNeedMonthly({ basis: 'day', unitAmount: -500, days: 22 })).toBe(0);
    expect(recurringNeedMonthly(null)).toBe(0);
  });

  it('additionne transport, alimentation et logement', () => {
    const total = needsBreakdownTotal({
      transport: { basis: 'day', unitAmount: 500, days: 22 },
      food: { basis: 'day', unitAmount: 3_000, days: 30 },
      housing: { rent: 100_000, bills: 25_000, other: 15_000 },
    });
    expect(total).toBe(241_000);
  });

  it('renvoie 0 sans détail enregistré', () => {
    expect(needsBreakdownTotal(null)).toBe(0);
    expect(needsBreakdownTotal({} as never)).toBe(0);
  });
});

describe('message de coaching', () => {
  it('alerte quand les besoins dépassent les revenus', () => {
    expect(coachMessage(100_000, 130_000, 0).tone).toBe('danger');
  });

  it('encourage sous 10 %', () => {
    expect(coachMessage(200_000, 190_000, 0.05).tone).toBe('warning');
  });

  it('valide un objectif atteint', () => {
    expect(coachMessage(200_000, 100_000, 0.5).tone).toBe('positive');
  });

  it('ne culpabilise pas quand il n’y a pas de revenus', () => {
    expect(coachMessage(0, 0, 0).tone).toBe('neutral');
  });
});

describe('revenus irréguliers', () => {
  it('prend la médiane des mois complets, pas le meilleur mois', () => {
    const transactions = [
      tx({ type: 'income', amount: 200_000, occurred_on: '2026-10-04' }),
      tx({ type: 'income', amount: 100_000, occurred_on: '2026-09-04' }),
      tx({ type: 'income', amount: 900_000, occurred_on: '2026-11-02' }), // mois en cours
    ];
    expect(incomeMedian(transactions, 3, new Date(2026, 10, 15))).toEqual({
      median: 150_000,
      months: 2,
    });
  });

  it('ignore un mois sans revenu au lieu de le compter zéro', () => {
    const transactions = [tx({ type: 'income', amount: 120_000, occurred_on: '2026-10-10' })];
    expect(incomeMedian(transactions, 3, new Date(2026, 10, 15))).toEqual({
      median: 120_000,
      months: 1,
    });
  });

  it('renvoie zéro sans revenu enregistré', () => {
    expect(incomeMedian([], 3, new Date(2026, 10, 15))).toEqual({ median: 0, months: 0 });
  });
});

describe('bilan hebdomadaire', () => {
  const names = new Map([
    ['c1', 'Transport'],
    ['c2', 'Loisirs'],
  ]);
  const transactions = [
    tx({ id: 'a', type: 'income', amount: 200_000, occurred_on: '2026-11-03' }),
    tx({ id: 'b', category_id: 'c1', amount: 50_000, occurred_on: '2026-11-03' }),
    tx({ id: 'c', category_id: 'c2', amount: 30_000, occurred_on: '2026-11-04' }),
    tx({ id: 'd', type: 'income', amount: 100_000, occurred_on: '2026-10-28' }),
    tx({ id: 'e', category_id: 'c1', amount: 80_000, occurred_on: '2026-10-29' }),
  ];
  const review = weeklyReview(transactions, names, new Date(2026, 10, 4, 12));

  it('compare la semaine en cours à la précédente', () => {
    expect(review.from).toBe('2026-11-02');
    expect(review.to).toBe('2026-11-04');
    expect(review.income).toBe(200_000);
    expect(review.expenses).toBe(80_000);
    expect(review.saved).toBe(120_000);
    expect(review.previousSaved).toBe(20_000);
    expect(review.change).toBe(100_000);
  });

  it('identifie la catégorie la plus lourde de la semaine', () => {
    expect(review.topCategory).toEqual({ name: 'Transport', amount: 50_000 });
  });

  it('n’annonce aucune variation sans semaine précédente', () => {
    const fresh = weeklyReview(
      [tx({ type: 'income', amount: 10_000, occurred_on: '2026-11-03' })],
      names,
      new Date(2026, 10, 4, 12)
    );
    expect(fresh.change).toBeNull();
  });
});

describe('prochaine action utile', () => {
  const base = {
    onboarded: true,
    transactionCount: 12,
    monthIncome: 250_000,
    monthExpenses: 196_000,
    savingsRate: 0.216,
    goalRate: 0.2,
    emergencySaved: 400_000,
    emergencyTarget: 1_176_000,
    coverage: 0.1,
    activeGoals: 2,
  };

  it('demande de terminer l’onboarding avant tout', () => {
    expect(nextAction({ ...base, onboarded: false }).key).toBe('onboarding');
  });

  it('propose la première saisie quand la base est vide', () => {
    expect(nextAction({ ...base, transactionCount: 0 }).key).toBe('first-transaction');
  });

  it('signale un budget dépassé', () => {
    expect(nextAction({ ...base, monthExpenses: 300_000 }).key).toBe('over-budget');
  });

  it('priorise le fonds d’urgence sur le taux d’épargne', () => {
    expect(nextAction({ ...base, savingsRate: 0.05 }).key).toBe('emergency');
  });

  it('passe à l’objectif de taux quand le fonds est complet', () => {
    expect(
      nextAction({ ...base, emergencySaved: 1_200_000, savingsRate: 0.1 }).key
    ).toBe('rate');
  });

  it('propose un objectif quand il n’en existe aucun', () => {
    expect(
      nextAction({
        ...base,
        emergencySaved: 1_200_000,
        savingsRate: 0.25,
        activeGoals: 0,
      }).key
    ).toBe('no-goal');
  });

  it('termine sur une trajectoire positive', () => {
    expect(
      nextAction({
        ...base,
        emergencySaved: 1_200_000,
        savingsRate: 0.25,
        coverage: 0.4,
      }).key
    ).toBe('on-track');
  });

  it('donne toujours une action, quelle que soit la situation', () => {
    const action = nextAction({ ...base, emergencySaved: 0, emergencyTarget: 0 });
    expect(action.title.length).toBeGreaterThan(0);
    expect(action.cta.to.startsWith('/')).toBe(true);
  });
});

describe('objectifs', () => {
  it('borne la progression entre 0 et 1', () => {
    expect(goalProgress(50_000, 100_000)).toBe(0.5);
    expect(goalProgress(150_000, 100_000)).toBe(1);
    expect(goalProgress(-10, 100_000)).toBe(0);
  });

  it('renvoie 0 pour une cible nulle', () => {
    expect(goalProgress(10_000, 0)).toBe(0);
  });
});
