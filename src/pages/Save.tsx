import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
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
  useDeleteGoal,
  useDeleteTransaction,
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
  goalProgress,
  monthLabel,
  monthlySummaries,
  num,
  savingsRate,
  shortMonthLabel,
} from '../lib/calc';
import { categoryIcon } from '../lib/icons';
import { TransactionSheet } from '../components/TransactionSheet';
import type { Goal, Transaction, TxType } from '../lib/types';

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
          stroke="rgba(255,255,255,0.1)"
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

export default function Save() {
  const { userId } = useAuth();
  const { data } = useWorkspace(userId);
  const { open: openTx } = useTxSheet();
  const deleteTransaction = useDeleteTransaction(userId);
  const addGoal = useAddGoal(userId);
  const contributeGoal = useContributeGoal(userId);
  const deleteGoal = useDeleteGoal(userId);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [goalPocket, setGoalPocket] = useState<Goal['pocket']>('assets');
  const [goalError, setGoalError] = useState<string | null>(null);
  const [funding, setFunding] = useState<Goal | null>(null);
  const [fundAmount, setFundAmount] = useState('');
  const [fundError, setFundError] = useState<string | null>(null);
  const [month, setMonth] = useState(currentMonthKey());
  const [filter, setFilter] = useState<'all' | TxType>('all');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [editingOpen, setEditingOpen] = useState(false);

  const derived = useMemo(() => {
    if (!data) return null;
    const kinds = new Map<string, 'need' | 'want' | null>(
      data.categories.map((category) => [category.id, category.kind])
    );
    const summaries = monthlySummaries(
      data.transactions,
      kinds,
      { income: num(data.profile.avg_income), needs: num(data.profile.avg_needs) },
      12
    );
    const hasMonth = summaries.some((item) => item.month === month);
    const selected = summaries.find((item) => item.month === month) ?? {
      month,
      income: 0,
      needs: 0,
      wants: 0,
      savings: 0,
    };
    const monthTransactions = data.transactions
      .filter((tx) => tx.occurred_on.slice(0, 7) === month)
      .filter((tx) => (filter === 'all' ? true : tx.type === filter))
      .sort((a, b) => (a.occurred_on < b.occurred_on ? 1 : -1));
    return { summaries, selected, hasMonth, monthTransactions };
  }, [data, month, filter]);

  if (!data || !derived) return null;

  const currency = data.profile.currency;
  const goalRate = num(data.profile.savings_rate_goal) / 100;
  const rate = savingsRate(derived.selected.income, derived.selected.needs);
  const coach = coachMessage(
    derived.selected.income,
    derived.selected.needs,
    rate,
    num(data.profile.savings_rate_goal)
  );
  const overBudget = derived.selected.needs > derived.selected.income && derived.selected.income > 0;
  const months = [...derived.summaries].reverse();

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
        monthly_contribution: 0,
      });
      setGoalOpen(false);
      setGoalName('');
      setGoalTarget('');
      setGoalDate('');
      setGoalPocket('assets');
    } catch (err) {
      setGoalError(err instanceof Error ? err.message : 'Enregistrement impossible.');
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

          <dl className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: 'Revenus', value: derived.selected.income },
              { label: 'Besoins', value: derived.selected.needs },
              { label: 'Envies', value: derived.selected.wants },
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

      <section>
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
                        {goal.pocket ? POCKET_LABEL[goal.pocket] : 'Objectif libre'}
                        {goal.target_date ? ` · ${formatDate(goal.target_date)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-mist transition-colors hover:bg-coral/10 hover:text-coral"
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
                    className="btn btn-ghost mt-3 h-9 w-full text-[13px] text-accent"
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
          <ul className="card divide-y divide-white/5 p-2">
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
                      tx.type === 'income' ? 'text-accent' : 'text-snow'
                    )}
                  >
                    {tx.type === 'income' ? '+' : '−'}
                    {formatAmount(num(tx.amount), currency)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-mist transition-colors hover:bg-white/5 hover:text-snow"
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
                      className="flex h-9 w-9 items-center justify-center rounded-full text-mist transition-colors hover:bg-coral/10 hover:text-coral"
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
