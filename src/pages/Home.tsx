import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Compass,
  CreditCard,
  PiggyBank,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useWorkspace } from '../lib/queries';
import { useTxSheet } from '../components/AppShell';
import {
  Alert,
  CoachNote,
  EmptyState,
  IconCircle,
  ProgressBar,
  SectionTitle,
  cn,
} from '../components/ui';
import { currencyLabel, formatAmount, formatDay, formatPercent, initials } from '../lib/format';
import {
  coachMessage,
  currentMonthKey,
  debtBalanceTotal,
  debtMonthlyTotal,
  debtToIncomeRatio,
  emergencyTarget,
  freedomCapital,
  incomeMedian,
  monthLabel,
  monthlySummaries,
  netWorth,
  nextAction,
  num,
  receivableTotal,
  pocketAmounts,
  savingsRate,
  weeklyReview,
} from '../lib/calc';
import { categoryIcon } from '../lib/icons';
import type { Tip } from '../lib/types';

const POCKETS = [
  {
    key: 'subsistence',
    label: 'Subsistance',
    short: 'Ce qui sert',
    color: '#3B4656',
  },
  { key: 'assets', label: 'Assets', short: 'Ce qui rapporte', color: '#A8FF00' },
  {
    key: 'protection',
    label: 'Protection',
    short: 'Ce qui protège',
    color: '#E9EEF3',
  },
] as const;

export default function Home() {
  const { userId, session } = useAuth();
  const { data } = useWorkspace(userId);
  const { open: openTx } = useTxSheet();
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setRevealed(true), 220);
    return () => window.clearTimeout(timer);
  }, []);

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
    const current = summaries[summaries.length - 1];
    const monthKey = currentMonthKey();

    const income = current?.income ?? 0;
    const needs = current?.needs ?? 0;
    const wants = current?.wants ?? 0;
    const saved = current?.savings ?? 0;
    const rate = savingsRate(
      income,
      needs + (current?.savingsOut ?? 0) + (current?.debtPayments ?? 0)
    );
    const pockets = pocketAmounts(saved, data.allocation);
    const needsForPlanning =
      (needs > 0 ? needs : num(data.profile.avg_needs)) + debtMonthly;
    const emergencyGoal =
      data.emergency.target_amount != null
        ? num(data.emergency.target_amount)
        : emergencyTarget(needsForPlanning, data.profile.emergency_months);
    const target = freedomCapital(needsForPlanning);

    const debtRatio = debtToIncomeRatio(
      debtMonthly,
      income > 0 ? income : num(data.profile.avg_income)
    );
    const assetsValue = data.assets.reduce((sum, asset) => sum + num(asset.value), 0);
    const declaredPassive = data.assets.reduce((sum, asset) => sum + num(asset.monthly_income), 0);
    const passive = declaredPassive > 0 ? declaredPassive : assetsValue * 0.04 / 12;
    const coverage = needsForPlanning > 0 ? passive / needsForPlanning : 0;

    const tipsByCategory = new Map<string, Tip[]>();
    for (const tip of data.tips) {
      const list = tipsByCategory.get(tip.category) ?? [];
      list.push(tip);
      tipsByCategory.set(tip.category, list);
    }
    const preferred =
      rate < 0.1 ? 'Épargner' : coverage > 0.05 ? 'Investir' : needs > income ? 'Protéger' : 'Mentalité';
    const pool = tipsByCategory.get(preferred) ?? data.tips;
    const dayIndex = Math.floor(Date.now() / 86_400_000);
    const tip = pool[dayIndex % Math.max(1, pool.length)] ?? null;

    const recent = [...data.transactions]
      .sort((a, b) => (a.occurred_on < b.occurred_on ? 1 : -1))
      .slice(0, 5);

    const names = new Map(data.categories.map((category) => [category.id, category.name]));
    const review = weeklyReview(data.transactions, names);
    const hasVariableIncome = data.transactions.some(
      (tx) => tx.type === 'income' && tx.income_kind === 'variable'
    );
    const variableBase = incomeMedian(data.transactions);

    return {
      income,
      needs,
      wants,
      saved,
      rate,
      pockets,
      needsForPlanning,
      debtMonthly,
      debtRatio,
      debtBalance: debtBalanceTotal(data.debts),
      receivable: receivableTotal(data.debts),
      netAssets: netWorth(assetsValue, data.debts),
      emergencyGoal,
      target,
      assetsValue,
      passive,
      coverage,
      tip,
      recent,
      monthKey,
      summaries,
      review,
      hasVariableIncome,
      variableBase,
    };
  }, [data]);

  if (!data || !derived) return null;

  const currency = data.profile.currency;
  const coach = coachMessage(derived.income, derived.needs, derived.rate, num(data.profile.savings_rate_goal));
  const goalRate = num(data.profile.savings_rate_goal) / 100;
  const rateProgress = goalRate > 0 ? derived.rate / goalRate : 0;
  const firstName = data.profile.first_name || session?.user.email?.split('@')[0] || '';
  const emergencySaved = Math.max(
    num(data.emergency.amount_saved),
    data.goals
      .filter((goal) => goal.pocket === 'protection' || /urgence/i.test(goal.name))
      .reduce((sum, goal) => sum + num(goal.current_amount), 0)
  );
  const emergencyProgress = derived.emergencyGoal > 0 ? emergencySaved / derived.emergencyGoal : 0;
  const allocationTotal =
    num(data.allocation.pct_subsistence) +
    num(data.allocation.pct_assets) +
    num(data.allocation.pct_protection);

  const action = nextAction({
    onboarded: data.profile.onboarded,
    transactionCount: data.transactions.length,
    monthIncome: derived.income,
    monthExpenses: derived.needs + derived.wants,
    savingsRate: derived.rate,
    goalRate,
    emergencySaved,
    emergencyTarget: derived.emergencyGoal,
    coverage: derived.coverage,
    activeGoals: data.goals.length,
  });

  return (
    <div className="fade-up space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-mist">
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <h1 className="mt-1 text-[30px] leading-tight sm:text-[38px]">
            Salut {firstName || 'toi'}.
          </h1>
        </div>
        <button type="button" className="btn btn-primary sm:hidden" onClick={() => openTx('expense')}>
          <Plus size={16} strokeWidth={2} />
          Ajouter
        </button>
      </header>

      {/* Prochaine action utile : une seule à la fois, choisie par les chiffres */}
      <section
        data-tour="next-action"
        className="card flex flex-wrap items-center gap-4 p-4 sm:p-5"
        aria-labelledby="next-action-title"
      >
        <IconCircle icon={Target} tone="accent" size={44} />
        <div className="min-w-0 flex-1">
          <p className="label">Ta prochaine action</p>
          <p id="next-action-title" className="mt-0.5 text-[16px] font-semibold">
            {action.title}
          </p>
          <p className="mt-1 max-w-[60ch] text-[13px] leading-relaxed text-mist">
            {action.body}
          </p>
        </div>
        <Link to={action.cta.to} className="btn btn-secondary h-11 shrink-0 text-[13px]">
          {action.cta.label}
          <ArrowRight size={15} strokeWidth={2} />
        </Link>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Carte vedette */}
        <section
          data-tour="month-card"
          className="card-feature flex flex-col justify-between p-5 sm:p-7 lg:col-span-2"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[13px] font-semibold text-ink/75">
                Épargne de {monthLabel(derived.monthKey)}
              </p>
              <p className="num mt-2 text-[38px] font-semibold leading-none sm:text-[46px]">
                {formatAmount(derived.saved, currency)}
                <span className="ml-2 text-[15px] font-medium text-ink/75">
                  {currencyLabel(currency)}
                </span>
              </p>
              <p className="mt-2 text-[13px] font-medium text-ink/70">
                {derived.income > 0
                  ? `${formatPercent(derived.rate)} de tes revenus du mois`
                  : 'Ajoute un revenu pour calculer ton taux'}
              </p>
              {(() => {
                const last = derived?.summaries?.[derived.summaries.length - 1];
                return (last?.incomeEstimated ?? 0) > 0 || (last?.needsEstimated ?? 0) > 0 ? (
                  <p className="mt-1 text-[12px] text-ink/75">
                    Revenu {formatAmount(last?.incomeEstimated ?? 0, currency)} estimé · Besoins{' '}
                    {formatAmount(last?.needsEstimated ?? 0, currency)} estimés ce mois.
                  </p>
                ) : null;
              })()}
              {derived.hasVariableIncome && derived.variableBase.median > 0 ? (
                <p className="mt-1 text-[12px] text-ink/75">
                  Revenus variables : base de calcul{' '}
                  {formatAmount(derived.variableBase.median, currency)}, médiane de tes{' '}
                  {derived.variableBase.months} dernier
                  {derived.variableBase.months > 1 ? 's' : ''} mois complets.
                </p>
              ) : null}
            </div>
            <Link
              to="/epargner"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-ink/10 text-ink transition-colors hover:bg-ink/20"
              aria-label="Voir le détail de mon épargne"
            >
              <ArrowUpRight size={20} strokeWidth={1.75} />
            </Link>
          </div>

          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between text-[12px] font-medium text-ink/75">
              <span>Objectif {Math.round(goalRate * 100)} %</span>
              <span>
                {derived.rate >= goalRate
                  ? 'Objectif atteint'
                  : `Encore ${Math.round((goalRate - derived.rate) * 100)} pts`}
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-ink/15"
              role="progressbar"
              aria-valuenow={Math.min(100, Math.round(rateProgress * 100))}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progression vers ton objectif de taux d'épargne"
            >
              <div
                className="h-full rounded-full bg-ink transition-[width] duration-700 ease-out"
                style={{ width: revealed ? `${Math.min(100, Math.max(2, rateProgress * 100))}%` : '0%' }}
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-ink/8 p-3">
              <p className="text-[12px] font-medium text-ink/75">Revenus</p>
              <p className="num mt-0.5 text-[16px] font-semibold">
                {formatAmount(derived.income, currency)}{' '}
                <span className="text-[12px] font-medium text-ink/75">{currencyLabel(currency)}</span>
              </p>
            </div>
            <div className="rounded-2xl bg-ink/8 p-3">
              <p className="text-[12px] font-medium text-ink/75">Besoins</p>
              <p className="num mt-0.5 text-[16px] font-semibold">
                {formatAmount(derived.needs, currency)}{' '}
                <span className="text-[12px] font-medium text-ink/75">{currencyLabel(currency)}</span>
              </p>
            </div>
          </div>
        </section>

        {/* Fonds d'urgence */}
        <section className="card flex flex-col justify-between p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="label">Fonds d'urgence</p>
              <p className="num mt-2 text-[28px] font-semibold leading-none">
                {formatAmount(emergencySaved, currency)}
                <span className="ml-1.5 text-[13px] font-medium text-mist">
                  {currencyLabel(currency)}
                </span>
              </p>
            </div>
            <IconCircle icon={ShieldCheck} tone="accent" />
          </div>

          <div className="mt-5">
            <ProgressBar
              value={revealed ? emergencyProgress : 0}
              ariaLabel="Progression du fonds d'urgence"
            />
            <div className="mt-2 flex items-center justify-between text-[12px] text-mist">
              <span>Cible {formatAmount(derived.emergencyGoal, currency)}</span>
              <span>{formatPercent(Math.min(1, emergencyProgress))}</span>
            </div>
          </div>

          <Link
            to="/investir"
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-accent-text"
          >
            {emergencyProgress >= 1 ? 'Fonds complet, bravo' : 'Compléter mon fonds'}
            <ChevronRight size={15} strokeWidth={2} />
          </Link>
        </section>
      </div>

      {/* Chiffres du mois */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Revenus du mois', value: derived.income, icon: TrendingUp },
          { label: 'Besoins', value: derived.needs, icon: TrendingDown },
          { label: 'Envies', value: derived.wants, icon: Sparkles },
          { label: 'Remboursements', value: derived.debtMonthly, icon: CreditCard },
        ].map((item) => (
          <div key={item.label} className="card p-4">
            <div className="flex items-center justify-between">
              <p className="label">{item.label}</p>
              <item.icon size={16} strokeWidth={1.75} className="text-mist" aria-hidden="true" />
            </div>
            <p className="num mt-2 text-[24px] font-semibold leading-none">
              {formatAmount(item.value, currency)}
              <span className="ml-1.5 text-[12px] font-medium text-mist">{currencyLabel(currency)}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Dettes et patrimoine net */}
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label">Dettes et créances</p>
            <h2 className="mt-1 text-[22px]">
              {derived.debtBalance > 0
                ? `${formatAmount(derived.debtBalance, currency)} restent à rembourser`
                : 'Aucune dette enregistrée'}
            </h2>
          </div>
          <Link to="/epargner" className="btn btn-secondary h-11 text-[13px]">
            Gérer
            <ArrowRight size={15} strokeWidth={2} />
          </Link>
        </div>

        {derived.debtRatio > 0.3 ? (
          <div className="mt-4">
            <Alert
              tone={derived.debtRatio > 0.4 ? 'danger' : 'warning'}
              title={`Mensualités à ${formatPercent(derived.debtRatio)} de ton revenu`}
            >
              Au-delà de 30 %, la marge se réduit vite. L'ordre de remboursement conseillé est
              dans Épargner, section Dettes.
            </Alert>
          </div>
        ) : null}

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Dettes restantes', value: derived.debtBalance },
            { label: 'Mensualités', value: derived.debtMonthly },
            { label: 'Créances', value: derived.receivable },
            { label: 'Patrimoine net', value: derived.netAssets },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl bg-slate2/70 p-3">
              <dt className="text-[12px] text-mist">{item.label}</dt>
              <dd className="num mt-1 text-[15px] font-semibold">
                {formatAmount(item.value, currency)}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-3 text-[12px] leading-relaxed text-mist">
          {derived.debtMonthly > 0
            ? 'Tes mensualités de dette sont déjà déduites de ton épargne du mois et comptées dans tes besoins de planification (fonds d’urgence, capital de liberté).'
            : 'Déclare un crédit ou un prêt pour que ta marge réelle et ton patrimoine net soient justes.'}
        </p>
      </section>

      {/* Bilan de la semaine */}
      <section data-tour="weekly" className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label">Bilan de la semaine</p>
            <h2 className="mt-1 text-[22px]">
              {derived.review.income === 0 && derived.review.expenses === 0
                ? 'Rien d’enregistré cette semaine'
                : derived.review.saved > 0
                  ? `${formatAmount(derived.review.saved, currency)} gardés`
                  : 'Aucune épargne cette semaine'}
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate2 px-3 py-1 text-[12px] text-mist">
            <CalendarDays size={13} strokeWidth={1.75} aria-hidden="true" />
            {formatDay(derived.review.from)} → {formatDay(derived.review.to)}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate2/70 p-3">
            <dt className="text-[12px] text-mist">Gagné</dt>
            <dd className="num mt-1 text-[15px] font-semibold">
              {formatAmount(derived.review.income, currency)}
            </dd>
          </div>
          <div className="rounded-2xl bg-slate2/70 p-3">
            <dt className="text-[12px] text-mist">Dépensé</dt>
            <dd className="num mt-1 text-[15px] font-semibold">
              {formatAmount(derived.review.expenses, currency)}
            </dd>
          </div>
          <div className="rounded-2xl bg-slate2/70 p-3">
            <dt className="text-[12px] text-mist">Gardé</dt>
            <dd className="num mt-1 text-[15px] font-semibold">
              {formatAmount(derived.review.saved, currency)}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-[12px] leading-relaxed text-mist">
          {derived.review.change === null
            ? 'Première semaine suivie : le comparatif apparaîtra la semaine prochaine.'
            : derived.review.change === 0
              ? 'Même épargne que la semaine dernière.'
              : derived.review.change > 0
                ? `Tu as gardé ${formatAmount(derived.review.change, currency)} de plus que la semaine dernière.`
                : `Tu as gardé ${formatAmount(Math.abs(derived.review.change), currency)} de moins que la semaine dernière.`}
          {derived.review.topCategory
            ? ` Ta plus grosse sortie : ${derived.review.topCategory.name} (${formatAmount(derived.review.topCategory.amount, currency)}).`
            : ''}
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Vers la liberté */}
        <section className="card flex flex-col p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="label">Vers la liberté</p>
              <h2 className="mt-1 text-[22px]">
                {formatPercent(derived.coverage)} de tes besoins couverts
              </h2>
            </div>
            <IconCircle icon={Compass} />
          </div>

          <div className="mt-5">
            <ProgressBar
              value={revealed ? derived.coverage : 0}
              height={10}
              ariaLabel="Part des besoins couverts par tes assets"
            />
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <dt className="label">Assets actuels</dt>
              <dd className="num mt-1 text-[18px] font-semibold">
                {formatAmount(derived.assetsValue, currency)}
                <span className="ml-1 text-[12px] font-medium text-mist">{currencyLabel(currency)}</span>
              </dd>
            </div>
            <div>
              <dt className="label">Capital cible (4 %)</dt>
              <dd className="num mt-1 text-[18px] font-semibold">
                {formatAmount(derived.target, currency)}
                <span className="ml-1 text-[12px] font-medium text-mist">{currencyLabel(currency)}</span>
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/liberte" className="btn btn-secondary h-11 text-[13px]">
              Ouvrir le simulateur
            </Link>
            <Link to="/investir" className="btn btn-ghost h-11 text-[13px]">
              Ajouter un asset
            </Link>
          </div>
        </section>

        {/* Répartition */}
        <section className="card flex flex-col p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="label">Ta répartition</p>
              <h2 className="mt-1 text-[22px]">Où va ton épargne</h2>
            </div>
            <Link
              to="/investir"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-slate2 text-mist transition-colors hover:text-snow"
              aria-label="Ajuster la répartition"
            >
              <ArrowUpRight size={18} strokeWidth={1.75} />
            </Link>
          </div>

          <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
            {POCKETS.map((pocket) => (
              <div
                key={pocket.key}
                style={{
                  width: `${(num(data.allocation[`pct_${pocket.key}`]) / Math.max(1, allocationTotal)) * 100}%`,
                  backgroundColor: pocket.color,
                }}
              />
            ))}
          </div>

          <ul className="mt-4 space-y-3">
            {POCKETS.map((pocket) => (
              <li key={pocket.key} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: pocket.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-[14px] font-medium">{pocket.label}</span>
                  <span className="hidden text-[12px] text-mist sm:inline">{pocket.short}</span>
                </span>
                <span className="flex items-baseline gap-2 whitespace-nowrap">
                  <span className="num text-[14px] font-semibold">
                    {formatAmount(derived.pockets[pocket.key], currency)}
                  </span>
                  <span className="num w-9 text-right text-[12px] text-mist">
                    {Math.round(num(data.allocation[`pct_${pocket.key}`]))} %
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-[12px] text-mist">
            Calculé sur l'épargne du mois : {formatAmount(derived.saved, currency)}{' '}
            {currencyLabel(currency)}.
          </p>
        </section>
      </div>

      {/* Conseil du jour */}
      {derived.tip ? (
        <section className="card-paper p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-[12px] font-semibold text-ink">
              <BookOpen size={13} strokeWidth={2} aria-hidden="true" />
              Conseil du jour · {derived.tip.category}
            </span>
            <Link
              to="/conseils"
              className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-graphite"
            >
              Tous les conseils <ChevronRight size={14} strokeWidth={2} />
            </Link>
          </div>
          <h2 className="mt-4 text-[24px] leading-snug">{derived.tip.title}</h2>
          <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed text-graphite/75">
            {derived.tip.body}
          </p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <SectionTitle
            action={
              <Link
                to="/epargner"
                className="inline-flex min-h-11 items-center text-[13px] font-semibold text-mist hover:text-snow"
              >
                Tout voir
              </Link>
            }
          >
            Dernières transactions
          </SectionTitle>

          {derived.recent.length === 0 ? (
            <EmptyState
              icon={PiggyBank}
              title="Aucune transaction pour l'instant"
              action={
                <button type="button" className="btn btn-primary" onClick={() => openTx('expense')}>
                  Ajouter ta première dépense
                </button>
              }
            >
              Dès ta première saisie, ton épargne et ton taux se calculent tout seuls.
            </EmptyState>
          ) : (
            <ul className="card divide-y divide-line p-2">
              {derived.recent.map((tx) => {
                const category = data.categories.find((item) => item.id === tx.category_id);
                const Icon = categoryIcon(category?.icon, category?.name);
                return (
                  <li key={tx.id} className="flex items-center gap-3 px-2 py-3">
                    <IconCircle icon={Icon} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium">
                        {tx.note || category?.name || (tx.type === 'income' ? 'Revenu' : 'Dépense')}
                      </p>
                      <p className="text-[12px] text-mist">
                        {formatDay(tx.occurred_on)} · {category?.name ?? 'Sans catégorie'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'num shrink-0 text-[14px] font-semibold',
                        tx.type === 'income' ? 'text-accent-text' : 'text-snow'
                      )}
                    >
                      {tx.type === 'income' ? '+' : '−'}
                      {formatAmount(num(tx.amount), currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <p className="label">Ton coach</p>
          <div className="mt-3">
            <CoachNote tone={coach.tone} title={coach.title}>
              {coach.body}
            </CoachNote>
          </div>
          <div className="mt-5 flex items-center gap-2">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-ink">
              {initials(firstName)}
            </span>
            <p className="text-[12px] text-mist">
              Libre est un outil pédagogique, pas un conseil financier personnalisé.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
