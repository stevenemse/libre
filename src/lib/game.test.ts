import { describe, expect, it } from 'vitest';
import { debtBosses, gameStats, type GameInput } from './game';
import type {
  Asset,
  Challenge,
  Debt,
  Goal,
  TipProgress,
  Transaction,
  UserChallenge,
} from './types';

let seq = 0;

const tx = (patch: Partial<Transaction> = {}): Transaction => ({
  id: `tx-${++seq}`,
  user_id: 'user-1',
  category_id: null,
  type: 'expense',
  amount: 0,
  occurred_on: '2026-05-10',
  note: null,
  recurrence: 'none',
  parent_tx_id: null,
  income_kind: null,
  goal_id: null,
  debt_id: null,
  created_at: '',
  ...patch,
});

const debt = (patch: Partial<Debt> = {}): Debt => ({
  id: `debt-${++seq}`,
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

const goal = (patch: Partial<Goal> = {}): Goal => ({
  id: `goal-${++seq}`,
  user_id: 'user-1',
  name: 'Fonds de sécurité',
  target_amount: 100_000,
  current_amount: 0,
  target_date: null,
  pocket: 'protection',
  debt_id: null,
  monthly_contribution: 0,
  archived: false,
  created_at: '',
  ...patch,
});

const asset = (patch: Partial<Asset> = {}): Asset => ({
  id: `asset-${++seq}`,
  user_id: 'user-1',
  name: 'Placement',
  asset_type: 'investissement',
  value: 0,
  monthly_income: 0,
  acquired_on: null,
  created_at: '',
  ...patch,
});

const progress = (read_at: string): TipProgress => ({
  user_id: 'user-1',
  tip_id: `tip-${++seq}`,
  read_at,
  favorite: false,
});

const challenge = (): Challenge => ({
  id: 'challenge-1',
  title: 'Sept jours sans dépense impulsive',
  description: null,
  duration_days: 7,
});

const userChallenge = (patch: Partial<UserChallenge> = {}): UserChallenge => ({
  id: `uc-${++seq}`,
  user_id: 'user-1',
  challenge_id: 'challenge-1',
  started_on: '2026-05-08',
  completed: false,
  check_ins: 2,
  last_check_in: '2026-05-09',
  completed_at: null,
  ...patch,
});

const input = (patch: Partial<GameInput> = {}): GameInput => ({
  transactions: [],
  progress: [],
  userChallenges: [],
  challenges: [],
  goals: [],
  assets: [],
  debts: [],
  emergencySaved: 0,
  emergencyTarget: 0,
  emergencyMonths: 0,
  savingsRate: 0,
  coverage: 0,
  monthlyNeeds: 100_000,
  tipsCount: 0,
  ...patch,
});

const dayISO = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const days = (count: number, endDay = 10): Transaction[] => {
  const end = new Date(`2026-05-${String(endDay).padStart(2, '0')}T12:00:00`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - index);
    return tx({ occurred_on: dayISO(date) });
  });
};

describe('niveaux et XP', () => {
  it('débloque le niveau 2 avec assez d’XP et un mois d’urgence', () => {
    const stats = gameStats(
      input({
        transactions: days(10),
        emergencySaved: 100_000,
        emergencyTarget: 100_000,
        emergencyMonths: 1,
      }),
      '2026-05-10'
    );

    expect(stats.xp).toBeGreaterThanOrEqual(120);
    expect(stats.level.index).toBe(2);
    expect(stats.level.name).toBe('Gardien');
    expect(stats.nextLocked).toBe(false);
  });

  it('bloque le palier suivant quand le jalon financier manque', () => {
    const stats = gameStats(input({ transactions: days(10) }), '2026-05-10');

    expect(stats.xp).toBeGreaterThanOrEqual(120);
    expect(stats.level.index).toBe(1);
    expect(stats.next?.index).toBe(2);
    expect(stats.nextLocked).toBe(true);
    expect(stats.levelProgress).toBe(1);
  });

  it('ne saute pas un rang quand un jalon précédent manque', () => {
    const stats = gameStats(
      input({
        transactions: days(20),
        savingsRate: 0.12,
        coverage: 1,
        assets: [asset({ value: 100_000 })],
      }),
      '2026-05-10'
    );

    expect(stats.xp).toBeGreaterThanOrEqual(650);
    expect(stats.level.index).toBe(1);
    expect(stats.next?.index).toBe(2);
    expect(stats.nextLocked).toBe(true);
  });
});

describe('série', () => {
  it('compte les jours consécutifs, même si aujourd’hui n’a pas encore d’action', () => {
    const stats = gameStats(
      input({ transactions: days(3, 10) }),
      '2026-05-11'
    );

    expect(stats.streak).toBe(3);
  });
});

describe('boss de dettes', () => {
  it('calcule la barre de vie à partir des remboursements suivis', () => {
    const active = debt({ id: 'debt-active', title: 'Crédit moto', balance: 600, monthly_payment: 100 });
    const bosses = debtBosses(
      [active],
      [tx({ debt_id: active.id, amount: 400 })]
    );

    expect(bosses[0].original).toBe(1_000);
    expect(bosses[0].repaid).toBe(400);
    expect(bosses[0].progress).toBeCloseTo(0.4);
    expect(bosses[0].cleared).toBe(false);
    expect(bosses[0].isNext).toBe(true);
  });

  it('marque un boss comme vaincu quand le solde atteint zéro', () => {
    const cleared = debt({ id: 'debt-cleared', title: 'Prêt', balance: 0 });
    const bosses = debtBosses(
      [cleared],
      [tx({ debt_id: cleared.id, amount: 500 })]
    );

    expect(bosses[0].original).toBe(500);
    expect(bosses[0].progress).toBe(1);
    expect(bosses[0].cleared).toBe(true);
    expect(bosses[0].isNext).toBe(false);
  });
});

describe('quête du jour', () => {
  it('propose d’abord une transaction quand aucune n’est saisie aujourd’hui', () => {
    const stats = gameStats(input(), '2026-05-10');
    expect(stats.quest.key).toBe('transaction');
    expect(stats.quest.done).toBe(false);
  });

  it('propose ensuite le check-in du défi actif', () => {
    const stats = gameStats(
      input({
        transactions: [tx({ occurred_on: '2026-05-10' })],
        challenges: [challenge()],
        userChallenges: [userChallenge({ last_check_in: '2026-05-09' })],
      }),
      '2026-05-10'
    );

    expect(stats.quest.key).toBe('challenge');
    expect(stats.quest.title).toContain('Sept jours');
  });

  it('propose le boss de dette quand le check-in est déjà fait', () => {
    const stats = gameStats(
      input({
        transactions: [tx({ occurred_on: '2026-05-10' })],
        challenges: [challenge()],
        userChallenges: [userChallenge({ last_check_in: '2026-05-10' })],
        debts: [debt({ balance: 50_000, monthly_payment: 5_000 })],
      }),
      '2026-05-10'
    );

    expect(stats.quest.key).toBe('debt');
    expect(stats.quest.title).toContain('Crédit');
  });
});

describe('badges', () => {
  it('débloque toute la collection quand les jalons sont atteints', () => {
    const debtId = 'debt-cleared';
    const stats = gameStats(
      input({
        transactions: [
          ...days(3, 10),
          tx({ occurred_on: '2026-05-10', debt_id: debtId, amount: 500 }),
        ],
        progress: ['2026-05-08', '2026-05-09', '2026-05-10', '2026-05-10', '2026-05-10'].map(
          (day) => progress(`${day}T10:00:00Z`)
        ),
        userChallenges: [userChallenge({ check_ins: 3, last_check_in: '2026-05-10' })],
        goals: [goal()],
        assets: [asset({ value: 100_000 })],
        debts: [debt({ id: debtId, balance: 0 })],
        emergencyMonths: 1,
        savingsRate: 0.12,
        coverage: 1,
      }),
      '2026-05-10'
    );

    expect(stats.badges.every((badge) => badge.unlocked)).toBe(true);
    expect(stats.badges).toHaveLength(8);
  });
});
