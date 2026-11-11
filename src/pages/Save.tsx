import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Pencil,
  Plus,
  Receipt,
  Target,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import {
  useAddGoal,
  useContributeGoal,
  useDeleteDebt,
  useDeleteGoal,
  useDeleteTransaction,
  useRepayDebt,
  useSaveDebt,
  useWorkspace,
} from '../lib/queries';
import { useTxSheet } from '../components/AppShell';
import {
  Alert,
  CoachNote,
  EmptyState,
  FieldError,
  IconCircle,
  ProgressBar,
  SectionTitle,
  Sheet,
  cn,
} from '../components/ui';
import { currencyLabel, formatAmount, formatDate, formatPercent } from '../lib/format';
import {
  coachMessage,
  currentMonthKey,
  debtBalanceTotal,
  debtMonthlyTotal,
  debtPayoffOrder,
  debtRepaymentPlan,
  debtToIncomeRatio,
  goalProgress,
  monthLabel,
  monthlySummaries,
  netWorth,
  netWorthHistory,
  num,
  receivableTotal,
  savingsRate,
  shortMonthLabel,
} from '../lib/calc';
import { categoryIcon } from '../lib/icons';
import { TransactionSheet } from '../components/TransactionSheet';
import type { Debt, Goal, Transaction, TxType } from '../lib/types';

const POCKET_LABEL: Record<string, string> = {
  subsistence: 'Subsistance',
  assets: 'Assets',
  protection: 'Protection',
};

const INCOME_KIND_LABEL: Record<string, string> = {
  fixed: 'fixe',
  variable: 'variable',
  one_off: 'ponctuel',
};

function HistoryChart({
  data,
  currency,
}: {
  data: Array<{ month: string; savings: number; income: number }>;
  currency: string;
}) {
  const width = 640;
  const height = 190;
  const paddingX = 8;
  const paddingTop = 18;
  const paddingBottom = 26;
  const max = Math.max(1, ...data.map((item) => item.savings));
  const slot = (width - paddingX * 2) / data.length;
  const barWidth = Math.min(28, slot * 0.55);
  const plotHeight = height - paddingTop - paddingBottom;

  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[190px] w-full"
        role="img"
        aria-label={`Épargne des 12 derniers mois. ${data
          .map((item) => `${shortMonthLabel(item.month)} : ${formatAmount(item.savings, currency)}`)
          .join(', ')}`}
      >
        <line
          x1={paddingX}
          x2={width - paddingX}
          y1={height - paddingBottom}
          y2={height - paddingBottom}
          className="stroke-line"
          strokeWidth={1}
        />
        {data.map((item, index) => {
          const x = paddingX + slot * index + (slot - barWidth) / 2;
          const barHeight = Math.max(item.savings > 0 ? 4 : 2, (item.savings / max) * plotHeight);
          const isCurrent = index === data.length - 1;
          return (
            <g key={item.month}>
              <rect
                x={x}
                y={height - paddingBottom - barHeight}
                width={barWidth}
                height={barHeight}
                rx={barWidth / 2}
                fill={isCurrent ? '#A8FF00' : 'rgba(168,255,0,0.28)'}
              >
                <title>{`${monthLabel(item.month)} : ${formatAmount(item.savings, currency)} ${currencyLabel(currency)}`}</title>
              </rect>
              <text
                x={x + barWidth / 2}
                y={height - 8}
                textAnchor="middle"
                fontSize="11"
                fill="rgba(139,151,167,0.9)"
                fontFamily="Urbanist, system-ui, sans-serif"
              >
                {shortMonthLabel(item.month).replace('.', '')}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">
        Épargne mensuelle sur 12 mois. Le mois en cours est mis en évidence en vert citron.
      </figcaption>
    </figure>
  );
}

function NetWorthChart({
  data,
  currency,
}: {
  data: Array<{ month: string; value: number }>;
  currency: string;
}) {
  const width = 640;
  const height = 170;
  const padding = { top: 16, right: 10, bottom: 24, left: 10 };
  const max = Math.max(1, ...data.map((item) => item.value));
  const min = Math.min(0, ...data.map((item) => item.value));
  const span = max - min || 1;
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const x = (index: number) =>
    padding.left + (data.length === 1 ? 0 : (index / (data.length - 1)) * plotW);
  const y = (value: number) => padding.top + plotH - ((value - min) / span) * plotH;
  const line = data.map((item, index) => `${x(index).toFixed(1)},${y(item.value).toFixed(1)}`);
  const zeroY = y(0);

  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[170px] w-full"
        role="img"
        aria-label={`Patrimoine net des 12 derniers mois. ${data
          .map((item) => `${shortMonthLabel(item.month)} : ${formatAmount(item.value, currency)}`)
          .join(', ')}`}
      >
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={zeroY}
          y2={zeroY}
          className="stroke-line"
          strokeDasharray="4 4"
        />
        <path
          d={`M ${line.join(' L ')}`}
          fill="none"
          stroke="#A8FF00"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        {data.map((item, index) => (
          <text
            key={item.month}
            x={x(index)}
            y={height - 8}
            textAnchor="middle"
            fontSize="10"
            fill="rgba(139,151,167,0.9)"
            fontFamily="Urbanist, system-ui, sans-serif"
          >
            {shortMonthLabel(item.month).replace('.', '')}
          </text>
        ))}
      </svg>
      <figcaption className="sr-only">
        Patrimoine net mensuel sur 12 mois : assets et créances actuels moins le solde de dette
        reconstitué à la fin de chaque mois.
      </figcaption>
    </figure>
  );
}

export default function Save() {
  const { userId } = useAuth();
  const { data } = useWorkspace(userId);
  const { open: openTx } = useTxSheet();
  const deleteTransaction = useDeleteTransaction(userId);
  const addGoal = useAddGoal(userId);
  const contributeGoal = useContributeGoal(userId);
  const deleteGoal = useDeleteGoal(userId);
  const saveDebt = useSaveDebt(userId);
  const deleteDebt = useDeleteDebt(userId);
  const repayDebt = useRepayDebt(userId);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [goalPocket, setGoalPocket] = useState<Goal['pocket']>(null);
  const [goalDebt, setGoalDebt] = useState('');
  const [goalError, setGoalError] = useState<string | null>(null);
  const [funding, setFunding] = useState<Goal | null>(null);
  const [fundAmount, setFundAmount] = useState('');
  const [fundError, setFundError] = useState<string | null>(null);
  const [month, setMonth] = useState(currentMonthKey());
  const [filter, setFilter] = useState<'all' | TxType>('all');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [editingOpen, setEditingOpen] = useState(false);

  const [debtOpen, setDebtOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [debtTitle, setDebtTitle] = useState('');
  const [debtDirection, setDebtDirection] = useState<Debt['direction']>('owed_by_me');
  const [debtCounterparty, setDebtCounterparty] = useState('');
  const [debtBalance, setDebtBalance] = useState('');
  const [debtMonthly, setDebtMonthly] = useState('');
  const [debtRate, setDebtRate] = useState('');
  const [debtError, setDebtError] = useState<string | null>(null);
  const [repaying, setRepaying] = useState<Debt | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayError, setRepayError] = useState<string | null>(null);
  const [payoffStrategy, setPayoffStrategy] = useState<'avalanche' | 'snowball'>('avalanche');

  const derived = useMemo(() => {
    if (!data) return null;
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
    const hasMonth = summaries.some((item) => item.month === month);
    const selected = summaries.find((item) => item.month === month) ?? {
      month,
      income: 0,
      needs: 0,
      wants: 0,
      savings: 0,
      savingsOut: 0,
      debtPayments: 0,
      incomeEstimated: 0,
      needsEstimated: 0,
    };
    const monthTransactions = data.transactions
      .filter((tx) => tx.occurred_on.slice(0, 7) === month)
      .filter((tx) => (filter === 'all' ? true : tx.type === filter))
      .sort((a, b) => (a.occurred_on < b.occurred_on ? 1 : -1));
    const assetsValue = data.assets.reduce((sum, asset) => sum + num(asset.value), 0);
    return {
      summaries,
      selected,
      hasMonth,
      monthTransactions,
      debtMonthly,
      debtBalance: debtBalanceTotal(data.debts),
      receivable: receivableTotal(data.debts),
      assetsValue,
      netAssets: netWorth(assetsValue, data.debts),
      netWorthHistory: netWorthHistory(data.transactions, data.debts, assetsValue),
    };
  }, [data, month, filter]);

  if (!data || !derived) return null;

  const currency = data.profile.currency;
  const goalRate = num(data.profile.savings_rate_goal) / 100;
  const rate = savingsRate(
    derived.selected.income,
    derived.selected.needs + derived.selected.savingsOut + derived.selected.debtPayments
  );
  const coach = coachMessage(
    derived.selected.income,
    derived.selected.needs,
    rate,
    num(data.profile.savings_rate_goal)
  );
  const overBudget = derived.selected.needs > derived.selected.income && derived.selected.income > 0;
  const months = [...derived.summaries].reverse();
  const incomeForRatio =
    derived.selected.income > 0 ? derived.selected.income : num(data.profile.avg_income);
  const debtRatio = debtToIncomeRatio(derived.debtMonthly, incomeForRatio);
  const orderedDebts = debtPayoffOrder(data.debts, payoffStrategy);

  const parseAmount = (value: string) =>
    Number.parseFloat(value.replace(/\s/g, '').replace(',', '.')) || 0;

  const submitGoal = async (event: React.FormEvent) => {
    event.preventDefault();
    setGoalError(null);
    const target = parseAmount(goalTarget);
    if (!goalName.trim()) {
      setGoalError('Donne un nom à ton objectif.');
      return;
    }
    if (target <= 0) {
      setGoalError('Indique un montant cible supérieur à zéro.');
      return;
    }
    try {
      await addGoal.mutateAsync({
        name: goalName.trim(),
        target_amount: target,
        target_date: goalDate || null,
        pocket: goalPocket,
        debt_id: goalDebt || null,
        monthly_contribution: 0,
      });
      setGoalOpen(false);
      setGoalName('');
      setGoalTarget('');
      setGoalDate('');
      setGoalPocket(null);
      setGoalDebt('');
    } catch (err) {
      setGoalError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  };

  const openDebt = (debt: Debt | null) => {
    setEditingDebt(debt);
    setDebtTitle(debt?.title ?? '');
    setDebtDirection(debt?.direction ?? 'owed_by_me');
    setDebtCounterparty(debt?.counterparty ?? '');
    setDebtBalance(debt ? String(num(debt.balance)) : '');
    setDebtMonthly(debt ? String(num(debt.monthly_payment)) : '');
    setDebtRate(debt?.interest_rate != null ? String(num(debt.interest_rate)) : '');
    setDebtError(null);
    setDebtOpen(true);
  };

  const submitDebt = async (event: React.FormEvent) => {
    event.preventDefault();
    setDebtError(null);
    const balance = parseAmount(debtBalance);
    const monthly = parseAmount(debtMonthly);
    if (!debtTitle.trim()) {
      setDebtError('Donne un nom à cette dette ou créance.');
      return;
    }
    if (balance <= 0 && monthly <= 0) {
      setDebtError('Indique au moins un solde restant ou une mensualité.');
      return;
    }
    try {
      await saveDebt.mutateAsync({
        id: editingDebt?.id,
        title: debtTitle.trim(),
        direction: debtDirection,
        counterparty: debtCounterparty.trim() || null,
        balance: Math.max(0, balance),
        monthly_payment: Math.max(0, monthly),
        interest_rate: debtRate.trim() ? Math.max(0, parseAmount(debtRate)) : null,
        due_date: editingDebt?.due_date ?? null,
      });
      setDebtOpen(false);
      setEditingDebt(null);
    } catch (err) {
      setDebtError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  };

  const submitRepay = async (event: React.FormEvent) => {
    event.preventDefault();
    setRepayError(null);
    if (!repaying) return;
    const amount = parseAmount(repayAmount);
    if (amount <= 0) {
      setRepayError('Saisis un montant supérieur à zéro.');
      return;
    }
    try {
      await repayDebt.mutateAsync({ id: repaying.id, amount });
      setRepaying(null);
      setRepayAmount('');
    } catch (err) {
      setRepayError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  };

  const submitFund = async (event: React.FormEvent) => {
    event.preventDefault();
    setFundError(null);
    const amount = parseAmount(fundAmount);
    if (!funding) return;
    if (amount <= 0) {
      setFundError('Saisis un montant supérieur à zéro.');
      return;
    }
    try {
      await contributeGoal.mutateAsync({ id: funding.id, amount });
      setFunding(null);
      setFundAmount('');
    } catch (err) {
      setFundError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  };

  return (
    <div className="fade-up space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Épargner</p>
          <h1 className="mt-1 text-[30px] leading-tight sm:text-[38px]">Ton épargne</h1>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="month-select">
            Choisir un mois
          </label>
          <select
            id="month-select"
            className="field h-10 w-auto appearance-none pr-8 text-[13px]"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          >
            {months.map((item) => (
              <option key={item.month} value={item.month}>
                {monthLabel(item.month)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary h-10 px-4 text-[13px]"
            onClick={() => openTx('expense')}
          >
            <Plus size={16} strokeWidth={2} />
            Ajouter
          </button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="label">{monthLabel(month)}</p>
              <p className="num mt-2 text-[38px] font-semibold leading-none">
                {formatAmount(derived.selected.savings, currency)}
                <span className="ml-2 text-[14px] font-medium text-mist">
                  {currencyLabel(currency)}
                </span>
              </p>
              <p className="mt-2 text-[13px] text-mist">
                {derived.selected.income > 0
                  ? `${formatPercent(rate)} de tes revenus, objectif ${Math.round(goalRate * 100)} %`
                  : 'Aucun revenu sur ce mois'}
              </p>
            </div>
            <IconCircle icon={Wallet} tone="accent" />
          </div>

          <div className="mt-6">
            <ProgressBar
              value={goalRate > 0 ? rate / goalRate : 0}
              ariaLabel="Taux d'épargne par rapport à ton objectif"
            />
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Revenus', value: derived.selected.income },
              { label: 'Besoins', value: derived.selected.needs },
              { label: 'Envies', value: derived.selected.wants },
              { label: 'Remboursements', value: derived.selected.debtPayments },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-slate2/70 p-3">
                <dt className="text-[11px] text-mist">{item.label}</dt>
                <dd className="num mt-1 text-[15px] font-semibold">
                  {formatAmount(item.value, currency)}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card p-5 sm:p-6">
          <p className="label">Ton coach</p>
          <div className="mt-3">
            <CoachNote tone={coach.tone} title={coach.title}>
              {coach.body}
            </CoachNote>
          </div>
          {overBudget ? (
            <div className="mt-4">
              <Alert tone="danger" title="Besoins au-dessus des revenus">
                Réduis d'abord un besoin récurrent de 10 % : c'est le levier le plus rapide.
              </Alert>
            </div>
          ) : null}
          <p className="mt-4 text-[12px] leading-relaxed text-mist">
            Épargne = revenus − besoins courants. Les envies ne réduisent pas ton épargne dans ce
            calcul, mais elles puisent dans ce qui reste.
          </p>
        </section>
      </div>

      <section data-tour="goals">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[22px]">Objectifs</h2>
          <button
            type="button"
            className="btn btn-secondary h-10 text-[13px]"
            onClick={() => setGoalOpen(true)}
          >
            <Plus size={15} strokeWidth={2} />
            Nouvel objectif
          </button>
        </div>

        {data.goals.length === 0 ? (
          <EmptyState icon={Target} title="Aucun objectif pour l'instant">
            Un fonds, un projet, une formation : un objectif chiffré donne une raison à ton épargne.
          </EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.goals.map((goal) => {
              const progress = goalProgress(num(goal.current_amount), num(goal.target_amount));
              const remaining = Math.max(0, num(goal.target_amount) - num(goal.current_amount));
              return (
                <li key={goal.id} className="card p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold">{goal.name}</p>
                      <p className="mt-0.5 text-[12px] text-mist">
                        {goal.debt_id
                          ? `Remboursement · ${data.debts.find((debt) => debt.id === goal.debt_id)?.title ?? 'dette'}`
                          : goal.pocket
                            ? POCKET_LABEL[goal.pocket]
                            : 'Objectif libre'}
                        {goal.target_date ? ` · ${formatDate(goal.target_date)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-mist transition-colors hover:bg-coral/10 hover:text-coral-text"
                      aria-label={`Supprimer l'objectif ${goal.name}`}
                      onClick={() => {
                        if (window.confirm(`Supprimer l'objectif « ${goal.name} » ?`)) {
                          deleteGoal.mutate(goal.id);
                        }
                      }}
                    >
                      <Trash2 size={15} strokeWidth={1.75} />
                    </button>
                  </div>

                  <p className="num mt-3 text-[20px] font-semibold leading-none">
                    {formatAmount(num(goal.current_amount), currency)}
                    <span className="ml-1.5 text-[12px] font-medium text-mist">
                      / {formatAmount(num(goal.target_amount), currency)}
                    </span>
                  </p>
                  <div className="mt-3">
                    <ProgressBar
                      value={progress}
                      height={8}
                      ariaLabel={`Progression de l'objectif ${goal.name}`}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[12px] text-mist">
                    <span>{Math.round(progress * 100)} %</span>
                    <span>
                      {remaining > 0
                        ? `Reste ${formatAmount(remaining, currency)}`
                        : 'Objectif atteint'}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost mt-3 h-9 w-full text-[13px] text-accent-text"
                    onClick={() => {
                      setFunding(goal);
                      setFundAmount('');
                      setFundError(null);
                    }}
                  >
                    <Plus size={14} strokeWidth={2} />
                    Verser sur cet objectif
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section data-tour="debts">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[22px]">Dettes et créances</h2>
          <button
            type="button"
            className="btn btn-secondary h-10 text-[13px]"
            onClick={() => openDebt(null)}
          >
            <Plus size={15} strokeWidth={2} />
            Nouvelle dette
          </button>
        </div>

        {data.debts.length === 0 ? (
          <EmptyState icon={CreditCard} title="Aucune dette enregistrée">
            Un crédit, un prêt d'un proche, une avance : déclare-le pour que tes mensualités
            entrent dans ta marge réelle et ton patrimoine net.
          </EmptyState>
        ) : (
          <>
            <div className="card mb-3 grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
              {[
                { label: 'Dettes restantes', value: derived.debtBalance },
                { label: 'Mensualités', value: derived.debtMonthly },
                { label: 'Créances', value: derived.receivable },
                { label: 'Patrimoine net', value: derived.netAssets },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate2/70 p-3">
                  <p className="text-[11px] text-mist">{item.label}</p>
                  <p className="num mt-1 text-[15px] font-semibold">
                    {formatAmount(item.value, currency)}
                  </p>
                </div>
              ))}
            </div>

            {debtRatio > 0.3 ? (
              <div className="mb-3">
                <Alert
                  tone={debtRatio > 0.4 ? 'danger' : 'warning'}
                  title={`Tes dettes absorbent ${formatPercent(debtRatio)} de ton revenu`}
                >
                  Au-delà de 30 %, ta marge se réduit vite. Priorise le remboursement et évite
                  d'ajouter une nouvelle mensualité avant d'avoir allégé celle-ci.
                </Alert>
              </div>
            ) : null}

            {orderedDebts.length >= 2 ? (
              <div className="card mb-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="label">Ordre de remboursement conseillé</p>
                  <div
                    className="flex gap-1.5"
                    role="group"
                    aria-label="Stratégie de remboursement"
                  >
                    <button
                      type="button"
                      className="pill"
                      aria-pressed={payoffStrategy === 'avalanche'}
                      onClick={() => setPayoffStrategy('avalanche')}
                    >
                      Avalanche
                    </button>
                    <button
                      type="button"
                      className="pill"
                      aria-pressed={payoffStrategy === 'snowball'}
                      onClick={() => setPayoffStrategy('snowball')}
                    >
                      Boule de neige
                    </button>
                  </div>
                </div>
                <ol className="mt-3 space-y-2">
                  {orderedDebts.map((debt, index) => (
                    <li key={debt.id} className="flex items-center gap-3 text-[13px]">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-ink">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{debt.title}</span>
                      <span className="num text-mist">
                        {formatAmount(num(debt.balance), currency)}
                      </span>
                      {num(debt.interest_rate) > 0 ? (
                        <span className="num text-mist">
                          {formatPercent(num(debt.interest_rate) / 100, 1)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-[12px] leading-relaxed text-mist">
                  {payoffStrategy === 'avalanche'
                    ? "Avalanche : le taux le plus élevé d'abord. C'est l'ordre qui coûte le moins d'intérêts."
                    : 'Boule de neige : le plus petit solde d’abord, pour gagner vite une victoire et garder la motivation.'}
                </p>
              </div>
            ) : null}

            <ul className="grid gap-3 sm:grid-cols-2">
              {data.debts.map((debt) => {
                const owedByMe = debt.direction === 'owed_by_me';
                return (
                  <li key={debt.id} className="card p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold">{debt.title}</p>
                        <p className="mt-0.5 text-[12px] text-mist">
                          {owedByMe ? 'Je dois' : 'On me doit'}
                          {debt.counterparty ? ` · ${debt.counterparty}` : ''}
                          {debt.interest_rate != null
                            ? ` · ${formatPercent(num(debt.interest_rate) / 100, 1)}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-full text-mist transition-colors hover:bg-veil hover:text-snow"
                          onClick={() => openDebt(debt)}
                          aria-label={`Modifier ${debt.title}`}
                        >
                          <Pencil size={15} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-full text-mist transition-colors hover:bg-coral/10 hover:text-coral-text"
                          onClick={() => {
                            if (window.confirm(`Supprimer « ${debt.title} » ?`)) {
                              deleteDebt.mutate(debt.id);
                            }
                          }}
                          aria-label={`Supprimer ${debt.title}`}
                        >
                          <Trash2 size={15} strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between gap-3">
                      <p className="num text-[20px] font-semibold leading-none">
                        {formatAmount(num(debt.balance), currency)}
                        <span className="ml-1.5 text-[12px] font-medium text-mist">
                          {owedByMe ? 'restants' : 'à recevoir'}
                        </span>
                      </p>
                      {owedByMe && num(debt.monthly_payment) > 0 ? (
                        <p className="num text-[13px] font-medium text-mist">
                          {formatAmount(num(debt.monthly_payment), currency)} / mois
                        </p>
                      ) : null}
                    </div>

                    {owedByMe
                      ? (() => {
                          const plan = debtRepaymentPlan(
                            num(debt.balance),
                            num(debt.monthly_payment),
                            debt.interest_rate
                          );
                          const faster = debtRepaymentPlan(
                            num(debt.balance),
                            num(debt.monthly_payment) * 1.1,
                            debt.interest_rate
                          );
                          return (
                            <div className="mt-2 space-y-0.5 text-[12px] text-mist">
                              {plan ? (
                                <p>
                                  {plan.months} mois restants
                                  {plan.totalInterest > 0
                                    ? ` · ${formatAmount(plan.totalInterest, currency)} d'intérêts`
                                    : ' · sans intérêts'}
                                </p>
                              ) : (
                                <p>Mensualité insuffisante pour couvrir les intérêts : augmente-la.</p>
                              )}
                              {plan && faster && plan.months > faster.months ? (
                                <p className="text-accent-text">
                                  Avec +10 % ({formatAmount(num(debt.monthly_payment) * 1.1, currency)}) :{' '}
                                  {faster.months} mois
                                  {plan.totalInterest > 0
                                    ? `, ${formatAmount(plan.totalInterest - faster.totalInterest, currency)} d'intérêts économisés`
                                    : ''}
                                  .
                                </p>
                              ) : null}
                            </div>
                          );
                        })()
                      : null}

                    {owedByMe && num(debt.balance) > 0 ? (
                      <button
                        type="button"
                        className="btn btn-ghost mt-3 h-9 w-full text-[13px] text-accent-text"
                        onClick={() => {
                          setRepaying(debt);
                          setRepayAmount(num(debt.monthly_payment) > 0 ? String(num(debt.monthly_payment)) : '');
                          setRepayError(null);
                        }}
                      >
                        <Wallet size={14} strokeWidth={2} />
                        Rembourser
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div className="card mt-3 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionTitle>Patrimoine net</SectionTitle>
                <p className="text-[12px] text-mist">Assets + créances − dettes</p>
              </div>
              <NetWorthChart data={derived.netWorthHistory} currency={currency} />
            </div>
          </>
        )}
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Histoire sur 12 mois</SectionTitle>
          <p className="text-[12px] text-mist">Épargne mensuelle</p>
        </div>
        <HistoryChart data={derived.summaries} currency={currency} />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[22px]">Transactions</h2>
          <div className="flex gap-1.5" role="group" aria-label="Filtrer les transactions">
            {(
              [
                { key: 'all', label: 'Tout' },
                { key: 'income', label: 'Revenus' },
                { key: 'expense', label: 'Dépenses' },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                className="pill"
                aria-pressed={filter === option.key}
                onClick={() => setFilter(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {derived.monthTransactions.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Rien sur ce mois"
            action={
              <button type="button" className="btn btn-primary" onClick={() => openTx('expense')}>
                Ajouter une dépense
              </button>
            }
          >
            Ajoute ta première dépense pour voir ton épargne calculée automatiquement.
          </EmptyState>
        ) : (
          <ul className="card divide-y divide-line p-2">
            {derived.monthTransactions.map((tx) => {
              const category = data.categories.find((item) => item.id === tx.category_id);
              const Icon = categoryIcon(category?.icon, category?.name);
              return (
                <li key={tx.id} className="group flex items-center gap-3 px-2 py-3">
                  <IconCircle icon={Icon} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">
                      {tx.note || category?.name || (tx.type === 'income' ? 'Revenu' : 'Dépense')}
                    </p>
                    <p className="flex items-center gap-1.5 text-[12px] text-mist">
                      {tx.type === 'income' ? (
                        <ArrowDownLeft size={12} aria-hidden="true" />
                      ) : (
                        <ArrowUpRight size={12} aria-hidden="true" />
                      )}
                      {formatDate(tx.occurred_on)} · {category?.name ?? 'Sans catégorie'}
                      {tx.type === 'income' && tx.income_kind
                        ? ` · revenu ${INCOME_KIND_LABEL[tx.income_kind]}`
                        : ''}
                      {tx.recurrence !== 'none' ? ' · récurrent' : ''}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'num text-[14px] font-semibold',
                      tx.type === 'income' ? 'text-accent-text' : 'text-snow'
                    )}
                  >
                    {tx.type === 'income' ? '+' : '−'}
                    {formatAmount(num(tx.amount), currency)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-mist transition-colors hover:bg-veil hover:text-snow"
                      onClick={() => {
                        setEditing(tx);
                        setEditingOpen(true);
                      }}
                      aria-label={`Modifier ${tx.note || category?.name || 'la transaction'}`}
                    >
                      <Pencil size={15} strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-mist transition-colors hover:bg-coral/10 hover:text-coral-text"
                      onClick={() => {
                        if (window.confirm('Supprimer cette transaction ?')) {
                          deleteTransaction.mutate(tx.id);
                        }
                      }}
                      aria-label={`Supprimer ${tx.note || category?.name || 'la transaction'}`}
                    >
                      <Trash2 size={15} strokeWidth={1.75} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-[12px] text-mist">
        Les transactions récurrentes sont générées automatiquement à leur échéance.
      </p>

      <Sheet
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        title="Nouvel objectif"
        subtitle="Un montant, une date, et Libre suit ta progression."
      >
        <form onSubmit={submitGoal} className="space-y-4">
          <div>
            <label htmlFor="goal-name" className="field-label">
              Nom de l'objectif
            </label>
            <input
              id="goal-name"
              className="field"
              value={goalName}
              onChange={(event) => setGoalName(event.target.value)}
              placeholder="Ex. Fonds d'urgence"
              maxLength={60}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="goal-target" className="field-label">
                Montant cible
              </label>
              <input
                id="goal-target"
                className="field"
                inputMode="decimal"
                value={goalTarget}
                onChange={(event) => setGoalTarget(event.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label htmlFor="goal-date" className="field-label">
                Date cible <span className="font-normal text-mist">(facultatif)</span>
              </label>
              <input
                id="goal-date"
                type="date"
                className="field"
                value={goalDate}
                onChange={(event) => setGoalDate(event.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="goal-debt" className="field-label">
              Dette à rembourser <span className="font-normal text-mist">(facultatif)</span>
            </label>
            <select
              id="goal-debt"
              className="field"
              value={goalDebt}
              onChange={(event) => setGoalDebt(event.target.value)}
            >
              <option value="">Aucune — épargne classique</option>
              {data.debts
                .filter((debt) => debt.direction === 'owed_by_me' && num(debt.balance) > 0)
                .map((debt) => (
                  <option key={debt.id} value={debt.id}>
                    {debt.title}
                  </option>
                ))}
            </select>
            <p className="label mt-1">
              Le versement réduit alors le solde de la dette au lieu de remplir une poche.
            </p>
          </div>

          <div>
            <span className="field-label">Poche</span>
            <div className="flex flex-wrap gap-2">
              {([null, 'subsistence', 'assets', 'protection'] as Array<Goal['pocket']>).map(
                (pocket) => (
                  <button
                    key={pocket ?? 'none'}
                    type="button"
                    className="pill"
                    aria-pressed={goalPocket === pocket}
                    onClick={() => setGoalPocket(pocket)}
                  >
                    {pocket ? POCKET_LABEL[pocket] : 'Libre'}
                  </button>
                )
              )}
            </div>
          </div>

          <FieldError>{goalError}</FieldError>

          <button type="submit" className="btn btn-primary w-full" disabled={addGoal.isPending}>
            {addGoal.isPending ? 'Création…' : "Créer l'objectif"}
          </button>
        </form>
      </Sheet>

      <Sheet
        open={Boolean(funding)}
        onClose={() => setFunding(null)}
        title="Verser sur un objectif"
        subtitle={funding?.name ?? undefined}
      >
        <form onSubmit={submitFund} className="space-y-4">
          <div>
            <label htmlFor="fund-amount" className="field-label">
              Montant
            </label>
            <input
              id="fund-amount"
              className="field h-16 text-[24px] font-semibold"
              inputMode="decimal"
              value={fundAmount}
              onChange={(event) => setFundAmount(event.target.value)}
              placeholder="0"
            />
          </div>
          <FieldError>{fundError}</FieldError>
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={contributeGoal.isPending}
          >
            {contributeGoal.isPending ? 'Enregistrement…' : 'Ajouter à cet objectif'}
          </button>
        </form>
      </Sheet>

      <Sheet
        open={debtOpen}
        onClose={() => {
          setDebtOpen(false);
          setEditingDebt(null);
        }}
        title={editingDebt ? 'Modifier la dette' : 'Nouvelle dette ou créance'}
        subtitle="Son solde et sa mensualité entrent dans tes calculs."
      >
        <form onSubmit={submitDebt} className="space-y-4">
          <div>
            <span className="field-label">Sens</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="pill"
                aria-pressed={debtDirection === 'owed_by_me'}
                onClick={() => setDebtDirection('owed_by_me')}
              >
                Je dois
              </button>
              <button
                type="button"
                className="pill"
                aria-pressed={debtDirection === 'owed_to_me'}
                onClick={() => setDebtDirection('owed_to_me')}
              >
                On me doit
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="debt-title" className="field-label">
              Nom
            </label>
            <input
              id="debt-title"
              className="field"
              value={debtTitle}
              onChange={(event) => setDebtTitle(event.target.value)}
              placeholder="Ex. Crédit moto"
              maxLength={60}
            />
          </div>

          <div>
            <label htmlFor="debt-counterparty" className="field-label">
              Prêteur ou débiteur <span className="font-normal text-mist">(facultatif)</span>
            </label>
            <input
              id="debt-counterparty"
              className="field"
              value={debtCounterparty}
              onChange={(event) => setDebtCounterparty(event.target.value)}
              placeholder="Ex. Banque, un proche"
              maxLength={60}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="debt-balance" className="field-label">
                Solde restant
              </label>
              <input
                id="debt-balance"
                className="field"
                inputMode="decimal"
                value={debtBalance}
                onChange={(event) => setDebtBalance(event.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label htmlFor="debt-monthly" className="field-label">
                Mensualité
              </label>
              <input
                id="debt-monthly"
                className="field"
                inputMode="decimal"
                value={debtMonthly}
                onChange={(event) => setDebtMonthly(event.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label htmlFor="debt-rate" className="field-label">
              Taux d'intérêt annuel <span className="font-normal text-mist">(facultatif)</span>
            </label>
            <div className="relative">
              <input
                id="debt-rate"
                className="field pr-10"
                inputMode="decimal"
                value={debtRate}
                onChange={(event) => setDebtRate(event.target.value)}
                placeholder="0"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12px] text-mist">
                %
              </span>
            </div>
          </div>

          <FieldError>{debtError}</FieldError>

          <button type="submit" className="btn btn-primary w-full" disabled={saveDebt.isPending}>
            {saveDebt.isPending ? 'Enregistrement…' : editingDebt ? 'Mettre à jour' : 'Enregistrer'}
          </button>
        </form>
      </Sheet>

      <Sheet
        open={Boolean(repaying)}
        onClose={() => setRepaying(null)}
        title="Rembourser une dette"
        subtitle={repaying?.title ?? undefined}
      >
        <form onSubmit={submitRepay} className="space-y-4">
          <div>
            <label htmlFor="repay-amount" className="field-label">
              Montant du remboursement
            </label>
            <input
              id="repay-amount"
              className="field h-16 text-[24px] font-semibold"
              inputMode="decimal"
              value={repayAmount}
              onChange={(event) => {
                setRepayAmount(event.target.value);
                setRepayError(null);
              }}
              placeholder="0"
            />
            <p className="label mt-1">
              Reste{' '}
              {formatAmount(
                Math.max(0, num(repaying?.balance) - parseAmount(repayAmount)),
                currency
              )}{' '}
              après ce versement.
            </p>
          </div>
          <FieldError>{repayError}</FieldError>
          <button type="submit" className="btn btn-primary w-full" disabled={repayDebt.isPending}>
            {repayDebt.isPending ? 'Enregistrement…' : 'Enregistrer le remboursement'}
          </button>
        </form>
      </Sheet>

      <TransactionSheet
        open={editingOpen}
        onClose={() => {
          setEditingOpen(false);
          setEditing(null);
        }}
        userId={userId}
        currency={currency}
        editing={editing}
      />
    </div>
  );
}
