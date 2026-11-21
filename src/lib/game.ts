import {
  debtMonthlyTotal,
  debtPayoffOrder,
  debtRepaymentPlan,
  emergencyTarget,
  monthlySummaries,
  num,
  savingsRate,
} from './calc';
import { todayISO } from './format';
import type {
  Asset,
  Challenge,
  Debt,
  Goal,
  TipProgress,
  Transaction,
  UserChallenge,
  Workspace,
} from './types';

/**
 * Le moteur du parcours Libre : aucun stockage de points, tout est dérivé des
 * vraies actions et des vrais chiffres. Une action supprimée peut donc faire
 * redescendre l'XP, mais jamais les jalons financiers déjà atteints.
 */

export interface GameInput {
  transactions: Transaction[];
  progress: TipProgress[];
  userChallenges: UserChallenge[];
  challenges: Challenge[];
  goals: Goal[];
  assets: Asset[];
  debts: Debt[];
  emergencySaved: number;
  emergencyTarget: number;
  emergencyMonths: number;
  savingsRate: number;
  coverage: number;
  monthlyNeeds: number;
  tipsCount: number;
}

export interface GameLevel {
  index: number;
  key: string;
  name: string;
  xp: number;
  requirement: string;
}

interface LevelDef extends GameLevel {
  met: (input: GameInput) => boolean;
}

const LEVELS: LevelDef[] = [
  {
    index: 1,
    key: 'premier-pas',
    name: 'Premier pas',
    xp: 0,
    requirement: 'Commencer à suivre tes chiffres',
    met: () => true,
  },
  {
    index: 2,
    key: 'gardien',
    name: 'Gardien',
    xp: 120,
    requirement: 'Un mois de fonds d’urgence',
    met: (input) => input.emergencyMonths >= 1,
  },
  {
    index: 3,
    key: 'batisseur',
    name: 'Bâtisseur',
    xp: 320,
    requirement: 'Un taux d’épargne d’au moins 10 %',
    met: (input) => input.savingsRate >= 0.1,
  },
  {
    index: 4,
    key: 'investisseur',
    name: 'Investisseur',
    xp: 650,
    requirement: 'Au moins un asset qui travaille',
    met: (input) => input.assets.some((asset) => num(asset.value) > 0),
  },
  {
    index: 5,
    key: 'libre',
    name: 'Libre',
    xp: 1100,
    requirement: '100 % de tes besoins couverts par tes assets',
    met: (input) => input.coverage >= 1,
  },
];

export interface GameBadge {
  key: string;
  label: string;
  description: string;
  unlocked: boolean;
}

export interface GameQuest {
  key: string;
  title: string;
  body: string;
  xp: number;
  done: boolean;
  cta: {
    label: string;
    to?: string;
    action?: 'transaction';
  };
}

export interface DebtBoss {
  id: string;
  title: string;
  balance: number;
  monthlyPayment: number;
  interestRate: number | null;
  repaid: number;
  original: number;
  progress: number;
  months: number | null;
  cleared: boolean;
  isNext: boolean;
}

export interface GameStats {
  xp: number;
  level: GameLevel;
  next: GameLevel | null;
  nextLocked: boolean;
  levelProgress: number;
  streak: number;
  badges: GameBadge[];
  quest: GameQuest;
  debtBosses: DebtBoss[];
  activeDebtCount: number;
  clearedDebtCount: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const shiftDay = (iso: string, days: number): string => {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
};

const dateOf = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
};

/** Dates où une vraie action a eu lieu, pour la série et l'XP d'habitude. */
function activityDates(input: GameInput): Set<string> {
  const dates = new Set<string>();
  for (const tx of input.transactions) {
    const day = dateOf(tx.occurred_on);
    if (day) dates.add(day);
  }
  for (const progress of input.progress) {
    const day = dateOf(progress.read_at);
    if (day) dates.add(day);
  }
  for (const challenge of input.userChallenges) {
    const day = dateOf(challenge.last_check_in);
    if (day) dates.add(day);
    if (challenge.check_ins > 0) {
      const started = dateOf(challenge.started_on);
      if (started) dates.add(started);
    }
  }
  return dates;
}

function consecutiveDays(dates: Set<string>, today: string): number {
  let cursor = dates.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (dates.has(cursor) && streak < 3650) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

function levelFor(xp: number, input: GameInput): { level: LevelDef; next: LevelDef | null } {
  let level = LEVELS[0];
  for (const candidate of LEVELS) {
    const previousMet = LEVELS.slice(0, candidate.index).every((item) => item.met(input));
    if (xp < candidate.xp || !previousMet) break;
    level = candidate;
  }
  return { level, next: LEVELS[level.index] ?? null };
}

function computeXp(input: GameInput, dates: Set<string>, repaymentCount: number): number {
  const tipsRead = input.progress.filter((tip) => tip.read_at).length;
  const checkIns = input.userChallenges.reduce(
    (sum, challenge) => sum + Math.max(0, num(challenge.check_ins)),
    0
  );
  const completedChallenges = input.userChallenges.filter((challenge) => challenge.completed).length;
  const goalContributions = input.transactions.filter(
    (tx) => tx.type === 'expense' && tx.goal_id && !tx.debt_id
  ).length;
  const assetsValue = input.assets.reduce((sum, asset) => sum + Math.max(0, num(asset.value)), 0);
  const emergencyBonus =
    input.emergencyMonths >= 3 ? 140 : input.emergencyMonths >= 1 ? 60 : 0;
  const savingsBonus = input.savingsRate >= 0.1 ? 70 : 0;
  const assetBonus = assetsValue > 0 ? 50 : 0;
  const coverageBonus = input.coverage >= 1 ? 200 : input.coverage >= 0.25 ? 80 : 0;

  return Math.round(
    dates.size * 20 +
      tipsRead * 10 +
      input.goals.length * 25 +
      input.assets.filter((asset) => num(asset.value) > 0).length * 35 +
      checkIns * 20 +
      completedChallenges * 70 +
      repaymentCount * 25 +
      goalContributions * 15 +
      emergencyBonus +
      savingsBonus +
      assetBonus +
      coverageBonus
  );
}

/** Chaque dette est un boss : sa barre de vie baisse à chaque remboursement suivi. */
export function debtBosses(debts: Debt[], transactions: Transaction[]): DebtBoss[] {
  const repaidByDebt = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.debt_id) continue;
    repaidByDebt.set(tx.debt_id, (repaidByDebt.get(tx.debt_id) ?? 0) + num(tx.amount));
  }

  const activeDebts = debts.filter((debt) => debt.direction === 'owed_by_me');
  const next = debtPayoffOrder(activeDebts, 'avalanche')[0];

  return activeDebts.map((debt) => {
    const balance = Math.max(0, num(debt.balance));
    const repaid = Math.max(0, repaidByDebt.get(debt.id) ?? 0);
    const original = balance + repaid;
    const cleared = balance === 0;
    const progress = cleared ? 1 : original > 0 ? Math.min(0.99, repaid / original) : 0;
    const plan = debtRepaymentPlan(
      balance,
      num(debt.monthly_payment),
      debt.interest_rate != null ? num(debt.interest_rate) : null
    );

    return {
      id: debt.id,
      title: debt.title,
      balance,
      monthlyPayment: num(debt.monthly_payment),
      interestRate: debt.interest_rate != null ? num(debt.interest_rate) : null,
      repaid,
      original,
      progress: clamp01(progress),
      months: plan?.months ?? null,
      cleared,
      isNext: next?.id === debt.id && !cleared,
    };
  });
}

function buildBadges(
  input: GameInput,
  stats: { streak: number; debtBosses: DebtBoss[] }
): GameBadge[] {
  const tipsRead = input.progress.filter((tip) => tip.read_at).length;
  const assetsValue = input.assets.reduce((sum, asset) => sum + Math.max(0, num(asset.value)), 0);
  const clearedBoss = stats.debtBosses.some((boss) => boss.cleared && boss.original > 0);

  return [
    {
      key: 'first-step',
      label: 'Premier pas',
      description: 'Enregistrer une première transaction.',
      unlocked: input.transactions.length > 0,
    },
    {
      key: 'reader',
      label: 'Curieux',
      description: 'Lire 5 conseils.',
      unlocked: tipsRead >= 5,
    },
    {
      key: 'streak',
      label: 'Série',
      description: 'Agir 3 jours d’affilée.',
      unlocked: stats.streak >= 3,
    },
    {
      key: 'shield',
      label: 'Bouclier',
      description: 'Atteindre un mois de fonds d’urgence.',
      unlocked: input.emergencyMonths >= 1,
    },
    {
      key: 'saver',
      label: 'Épargnant',
      description: 'Atteindre un taux d’épargne de 10 %.',
      unlocked: input.savingsRate >= 0.1,
    },
    {
      key: 'investor',
      label: 'Investisseur',
      description: 'Ajouter un asset qui travaille.',
      unlocked: assetsValue > 0,
    },
    {
      key: 'debt-slayer',
      label: 'Chasseur de dettes',
      description: 'Vaincre une dette.',
      unlocked: clearedBoss,
    },
    {
      key: 'free',
      label: 'Libre',
      description: 'Couvrir 100 % de tes besoins avec tes assets.',
      unlocked: input.coverage >= 1,
    },
  ];
}

function buildQuest(
  input: GameInput,
  bosses: DebtBoss[],
  today: string,
  dates: Set<string>
): GameQuest {
  const transactionToday = input.transactions.some(
    (tx) => dateOf(tx.occurred_on) === today
  );
  const tipToday = input.progress.some((tip) => dateOf(tip.read_at) === today);
  const checkInToday = input.userChallenges.some(
    (challenge) => dateOf(challenge.last_check_in) === today
  );
  const activeChallenge = input.userChallenges.find(
    (challenge) => !challenge.completed && challenge.challenge_id
  );
  const challenge = input.challenges.find(
    (item) => item.id === activeChallenge?.challenge_id
  );
  const nextBoss = bosses.find((boss) => boss.isNext) ?? bosses.find((boss) => !boss.cleared);
  const weekAgo = shiftDay(today, -6);
  const repaidThisWeek = input.transactions.some(
    (tx) =>
      tx.debt_id &&
      dateOf(tx.occurred_on) != null &&
      (dateOf(tx.occurred_on) as string) >= weekAgo &&
      (dateOf(tx.occurred_on) as string) <= today
  );
  const contributedThisMonth = input.transactions.some(
    (tx) => tx.goal_id && dateOf(tx.occurred_on)?.slice(0, 7) === today.slice(0, 7)
  );
  const goal = input.goals.find((item) => !item.archived);

  if (!transactionToday) {
    return {
      key: 'transaction',
      title: 'Enregistre une transaction',
      body: 'Un chiffre réel vaut mieux qu’une estimation. C’est le premier geste qui fait avancer ton parcours.',
      xp: dates.has(today) ? 0 : 20,
      done: false,
      cta: { label: 'Ajouter', action: 'transaction' },
    };
  }

  if (activeChallenge && challenge && !checkInToday) {
    return {
      key: 'challenge',
      title: `Coche ton défi : ${challenge.title}`,
      body: 'Un jour, une action. Ton défi avance quand tu le confirmes.',
      xp: 20,
      done: false,
      cta: { label: 'Voir mes défis', to: '/conseils' },
    };
  }

  if (nextBoss && !repaidThisWeek) {
    return {
      key: 'debt',
      title: `Attaque ${nextBoss.title}`,
      body: 'Chaque remboursement fait baisser la barre de vie de ce boss et libère de la marge.',
      xp: 25,
      done: false,
      cta: { label: 'Voir mes dettes', to: '/epargner' },
    };
  }

  if (input.tipsCount > 0 && !tipToday) {
    return {
      key: 'tip',
      title: 'Lis un conseil',
      body: 'Deux minutes pour gagner un point de lucidité et éviter une erreur coûteuse.',
      xp: 10,
      done: false,
      cta: { label: 'Ouvrir les conseils', to: '/conseils' },
    };
  }

  if (goal && !contributedThisMonth) {
    return {
      key: 'goal',
      title: `Verse sur ${goal.name}`,
      body: 'Un petit versement aujourd’hui vaut mieux qu’un grand projet reporté.',
      xp: 15,
      done: false,
      cta: { label: 'Voir mes objectifs', to: '/epargner' },
    };
  }

  return {
    key: 'done',
    title: 'Quête accomplie',
    body: 'Tu as fait bouger ta liberté aujourd’hui. Reviens demain pour la prochaine quête.',
    xp: 0,
    done: true,
    cta: { label: 'Voir ma liberté', to: '/liberte' },
  };
}

/** Calcule tout le parcours à partir des données du workspace. */
export function gameStats(input: GameInput, today = todayISO()): GameStats {
  const dates = activityDates(input);
  const repaymentCount = input.transactions.filter(
    (tx) => tx.type === 'expense' && tx.debt_id
  ).length;
  const xp = computeXp(input, dates, repaymentCount);
  const { level, next } = levelFor(xp, input);
  const nextLocked = Boolean(next && xp >= next.xp && !next.met(input));
  const span = next ? Math.max(1, next.xp - level.xp) : 1;
  const levelProgress = next ? clamp01((xp - level.xp) / span) : 1;
  const streak = consecutiveDays(dates, today);
  const bosses = debtBosses(input.debts, input.transactions);

  return {
    xp,
    level: {
      index: level.index,
      key: level.key,
      name: level.name,
      xp: level.xp,
      requirement: level.requirement,
    },
    next: next
      ? {
          index: next.index,
          key: next.key,
          name: next.name,
          xp: next.xp,
          requirement: next.requirement,
        }
      : null,
    nextLocked,
    levelProgress,
    streak,
    badges: buildBadges(input, { streak, debtBosses: bosses }),
    quest: buildQuest(input, bosses, today, dates),
    debtBosses: bosses,
    activeDebtCount: bosses.filter((boss) => !boss.cleared).length,
    clearedDebtCount: bosses.filter((boss) => boss.cleared).length,
  };
}

/** Version prête pour l'UI : calcule les métriques du mois, puis le parcours. */
export function gameStatsForWorkspace(data: Workspace, today = todayISO()): GameStats {
  const kinds = new Map<string, 'need' | 'want' | null>(
    data.categories.map((category) => [category.id, category.kind])
  );
  const debtMonthly = debtMonthlyTotal(data.debts);
  const summaries = monthlySummaries(
    data.transactions,
    kinds,
    {
      income: num(data.profile.avg_income),
      needs: num(data.profile.avg_needs),
      debtPayments: debtMonthly,
    },
    12
  );
  const current = summaries[summaries.length - 1];
  const income = current?.income ?? 0;
  const needs = current?.needs ?? 0;
  const rate = savingsRate(
    income,
    needs + (current?.savingsOut ?? 0) + (current?.debtPayments ?? 0)
  );
  const monthlyNeeds = (needs > 0 ? needs : num(data.profile.avg_needs)) + debtMonthly;
  const emergencySaved = Math.max(
    num(data.emergency.amount_saved),
    data.goals
      .filter((goal) => goal.pocket === 'protection' || /urgence/i.test(goal.name))
      .reduce((sum, goal) => sum + num(goal.current_amount), 0)
  );
  const emergencyTargetValue =
    data.emergency.target_amount != null
      ? num(data.emergency.target_amount)
      : emergencyTarget(monthlyNeeds, data.profile.emergency_months);
  const assetsValue = data.assets.reduce((sum, asset) => sum + Math.max(0, num(asset.value)), 0);
  const declaredPassive = data.assets.reduce(
    (sum, asset) => sum + Math.max(0, num(asset.monthly_income)),
    0
  );
  const passive = declaredPassive > 0 ? declaredPassive : (assetsValue * 0.04) / 12;
  const coverage = monthlyNeeds > 0 ? passive / monthlyNeeds : 0;

  return gameStats(
    {
      transactions: data.transactions,
      progress: data.progress,
      userChallenges: data.userChallenges,
      challenges: data.challenges,
      goals: data.goals,
      assets: data.assets,
      debts: data.debts,
      emergencySaved,
      emergencyTarget: emergencyTargetValue,
      emergencyMonths: monthlyNeeds > 0 ? emergencySaved / monthlyNeeds : 0,
      savingsRate: rate,
      coverage,
      monthlyNeeds,
      tipsCount: data.tips.length,
    },
    today
  );
}
