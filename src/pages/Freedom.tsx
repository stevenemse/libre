import { useEffect, useMemo, useState } from 'react';
import { Bookmark, Compass, Trash2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useDeleteSimulation, useSaveSimulation, useWorkspace } from '../lib/queries';
import { EmptyState, SectionTitle, cn } from '../components/ui';
import { currencyLabel, formatAmount, formatPercent } from '../lib/format';
import {
  currentMonthKey,
  freedomCapital,
  monthLabel,
  monthlySummaries,
  monthsToCoverNeeds,
  needsCovered,
  num,
  projectCapital,
  projectionSeries,
  pocketAmounts,
  savings,
} from '../lib/calc';

function GrowthChart({
  series,
  target,
  currency,
}: {
  series: number[];
  target: number;
  currency: string;
}) {
  const width = 720;
  const height = 240;
  const padding = { top: 16, right: 12, bottom: 24, left: 12 };
  const max = Math.max(target * 1.08, ...series, 1);
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const points = series.map((value, index) => {
    const x = padding.left + (series.length === 1 ? 0 : (index / (series.length - 1)) * plotW);
    const y = padding.top + plotH - (value / max) * plotH;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = `M ${points.join(' L ')}`;
  const area = `${line} L ${padding.left + plotW},${padding.top + plotH} L ${padding.left},${padding.top + plotH} Z`;
  const targetY = padding.top + plotH - (target / max) * plotH;

  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[240px] w-full"
        role="img"
        aria-label={`Projection du capital sur ${Math.round(
          (series.length - 1) / 12
        )} ans, de ${formatAmount(series[0], currency)} à ${formatAmount(
          series[series.length - 1],
          currency
        )} ${currencyLabel(currency)}. Objectif ${formatAmount(target, currency)}.`}
      >
        <defs>
          <linearGradient id="freedom-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A8FF00" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#A8FF00" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + plotH * f}
            y2={padding.top + plotH * f}
            className="stroke-line"
          />
        ))}

        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={height - padding.bottom}
          y2={height - padding.bottom}
          className="stroke-line-strong"
        />

        <path d={area} fill="url(#freedom-area)" />
        <path d={line} fill="none" stroke="#A8FF00" strokeWidth={3} strokeLinecap="round" />

        {target > 0 ? (
          <>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={targetY}
              y2={targetY}
              stroke="#8B97A7"
              strokeWidth={1.5}
              strokeDasharray="5 6"
            />
            <text
              x={width - padding.right}
              y={Math.max(12, targetY - 6)}
              textAnchor="end"
              fontSize="11"
              fill="#8B97A7"
              fontFamily="Urbanist, system-ui, sans-serif"
            >
              Capital de liberté
            </text>
          </>
        ) : null}
      </svg>
      <figcaption className="sr-only">
        Courbe de croissance du capital avec rendement composé. Ligne pointillée : capital de
        liberté visé.
      </figcaption>
    </figure>
  );
}

export default function Freedom() {
  const { userId } = useAuth();
  const { data } = useWorkspace(userId);
  const saveSimulation = useSaveSimulation(userId);
  const deleteSimulation = useDeleteSimulation(userId);

  const [needs, setNeeds] = useState('');
  const [contribution, setContribution] = useState('');
  const [annualReturn, setAnnualReturn] = useState(8);
  const [horizon, setHorizon] = useState(10);
  const [startCapital, setStartCapital] = useState('');
  const [label, setLabel] = useState('');
  const [saved, setSaved] = useState(false);
  const [compare, setCompare] = useState<{ a: string | null; b: string | null }>({
    a: null,
    b: null,
  });

  const defaults = useMemo(() => {
    if (!data) return { needs: 0, contribution: 0, capital: 0 };
    const kinds = new Map<string, 'need' | 'want' | null>(
      data.categories.map((category) => [category.id, category.kind])
    );
    const summaries = monthlySummaries(
      data.transactions,
      kinds,
      { income: num(data.profile.avg_income), needs: num(data.profile.avg_needs) },
      12
    );
    const current = summaries.find((item) => item.month === currentMonthKey());
    const monthlyNeeds = current?.needs || num(data.profile.avg_needs);
    const monthlySavings = Math.max(0, savings(current?.income ?? 0, current?.needs ?? 0) - (current?.savingsOut ?? 0));
    const pockets = pocketAmounts(monthlySavings, data.allocation);
    const capital = data.assets.reduce((sum, asset) => sum + num(asset.value), 0);
    return { needs: monthlyNeeds, contribution: pockets.assets, capital };
  }, [data]);

  useEffect(() => {
    setNeeds(String(Math.round(defaults.needs)));
    setContribution(String(Math.round(defaults.contribution)));
    setStartCapital(String(Math.round(defaults.capital)));
  }, [defaults]);

  const parsed = {
    needs: Number.parseFloat(needs.replace(',', '.')) || 0,
    contribution: Number.parseFloat(contribution.replace(',', '.')) || 0,
    start: Number.parseFloat(startCapital.replace(',', '.')) || 0,
  };

  const results = useMemo(() => {
    const months = horizon * 12;
    const series = projectionSeries({
      startCapital: parsed.start,
      monthlyContribution: parsed.contribution,
      annualReturn,
      months,
    });
    const target = freedomCapital(parsed.needs);
    const finalCapital = projectCapital({
      startCapital: parsed.start,
      monthlyContribution: parsed.contribution,
      annualReturn,
      months,
    });
    const monthsTo = monthsToCoverNeeds(parsed.start, parsed.contribution, annualReturn, parsed.needs);
    return {
      target,
      series,
      finalCapital,
      monthsTo,
      coverage: needsCovered(finalCapital, parsed.needs),
    };
  }, [parsed.start, parsed.contribution, parsed.needs, annualReturn, horizon]);

  if (!data) return null;
  const currency = data.profile.currency;
  const yearsTo = results.monthsTo === null ? null : Math.ceil(results.monthsTo / 12);

  const scenarioValue = (id: string) => {
    const scenario = data.simulations.find((item) => item.id === id);
    if (!scenario) return null;
    const months = scenario.horizon_years * 12;
    const capital = projectCapital({
      startCapital: num(scenario.start_capital),
      monthlyContribution: num(scenario.monthly_contribution),
      annualReturn: num(scenario.annual_return),
      months,
    });
    const monthsTo = monthsToCoverNeeds(
      num(scenario.start_capital),
      num(scenario.monthly_contribution),
      num(scenario.annual_return),
      num(scenario.monthly_needs)
    );
    return {
      scenario,
      capital,
      coverage: needsCovered(capital, num(scenario.monthly_needs)),
      years: monthsTo === null ? null : Math.ceil(monthsTo / 12),
    };
  };

  return (
    <div className="fade-up space-y-6">
      <header>
        <p className="label">Ma liberté</p>
        <h1 className="mt-1 text-[30px] leading-tight sm:text-[38px]">Quand seras-tu libre ?</h1>
        <p className="mt-2 max-w-[60ch] text-[14px] text-mist">
          La liberté financière, c'est quand tes assets couvrent tes besoins. Ajuste les curseurs et
          regarde le chemin.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <section data-tour="simulator" className="card p-5 sm:p-6">
          <div className="space-y-5">
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="sim-needs" className="text-[14px] font-medium">
                  Besoins mensuels
                </label>
                <span className="text-[12px] text-mist">{currencyLabel(currency)}</span>
              </div>
              <input
                id="sim-needs"
                className="field mt-2"
                inputMode="decimal"
                value={needs}
                onChange={(event) => setNeeds(event.target.value)}
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="sim-contribution" className="text-[14px] font-medium">
                  Versement mensuel vers les assets
                </label>
                <span className="text-[12px] text-mist">{currencyLabel(currency)}</span>
              </div>
              <input
                id="sim-contribution"
                className="field mt-2"
                inputMode="decimal"
                value={contribution}
                onChange={(event) => setContribution(event.target.value)}
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="sim-return" className="text-[14px] font-medium">
                  Rendement annuel estimé
                </label>
                <span className="num text-[14px] font-semibold">{annualReturn} %</span>
              </div>
              <input
                id="sim-return"
                type="range"
                min={2}
                max={15}
                step={0.5}
                value={annualReturn}
                onChange={(event) => setAnnualReturn(Number(event.target.value))}
                className="mt-2"
                aria-valuetext={`${annualReturn} pour cent par an`}
              />
              <div className="flex justify-between text-[11px] text-mist">
                <span>2 %</span>
                <span>15 %</span>
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="sim-horizon" className="text-[14px] font-medium">
                  Horizon
                </label>
                <span className="num text-[14px] font-semibold">{horizon} ans</span>
              </div>
              <input
                id="sim-horizon"
                type="range"
                min={1}
                max={40}
                step={1}
                value={horizon}
                onChange={(event) => setHorizon(Number(event.target.value))}
                className="mt-2"
                aria-valuetext={`${horizon} ans`}
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="sim-start" className="text-[14px] font-medium">
                  Capital de départ
                </label>
                <span className="text-[12px] text-mist">{currencyLabel(currency)}</span>
              </div>
              <input
                id="sim-start"
                className="field mt-2"
                inputMode="decimal"
                value={startCapital}
                onChange={(event) => setStartCapital(event.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-slate2/60 p-4">
            <p className="text-[13px] font-semibold">Enregistrer ce scénario</p>
            <div className="mt-2 flex gap-2">
              <input
                className="field h-10 flex-1"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Ex. Revenus locatifs"
                aria-label="Nom du scénario"
                maxLength={40}
              />
              <button
                type="button"
                className="btn btn-primary h-10 px-4 text-[13px]"
                disabled={saveSimulation.isPending}
                onClick={async () => {
                  await saveSimulation.mutateAsync({
                    label: label.trim() || `Scénario ${data.simulations.length + 1}`,
                    monthly_needs: parsed.needs,
                    monthly_contribution: parsed.contribution,
                    annual_return: annualReturn,
                    horizon_years: horizon,
                    start_capital: parsed.start,
                  });
                  setLabel('');
                  setSaved(true);
                  window.setTimeout(() => setSaved(false), 2000);
                }}
              >
                <Bookmark size={15} strokeWidth={1.75} />
                {saved ? 'Enregistré' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="label">Capital de liberté</p>
              <p className="num mt-1 text-[24px] font-semibold leading-tight">
                {formatAmount(results.target, currency)}
                <span className="ml-1 text-[11px] font-medium text-mist">
                  {currencyLabel(currency)}
                </span>
              </p>
            </div>
            <div>
              <p className="label">Années avant la liberté</p>
              <p className="num mt-1 text-[24px] font-semibold leading-tight text-accent-text">
                {yearsTo === null ? '—' : yearsTo === 0 ? 'Maintenant' : `${yearsTo} ans`}
              </p>
            </div>
            <div>
              <p className="label">Capital dans {horizon} ans</p>
              <p className="num mt-1 text-[20px] font-semibold">
                {formatAmount(results.finalCapital, currency)}
              </p>
            </div>
            <div>
              <p className="label">Besoins couverts</p>
              <p className="num mt-1 text-[20px] font-semibold">
                {formatPercent(Math.min(9.99, results.coverage))}
              </p>
            </div>
          </div>

          <GrowthChart series={results.series} target={results.target} currency={currency} />

          <p className="mt-2 text-[12px] leading-relaxed text-mist">
            Simulation indicative. Les rendements ne sont pas garantis et les résultats passés ne
            préjugent pas des résultats futurs.
          </p>
        </section>
      </div>

      <section>
        <SectionTitle>Scénarios enregistrés</SectionTitle>
        {data.simulations.length === 0 ? (
          <EmptyState icon={Compass} title="Aucun scénario">
            Enregistre une simulation pour la retrouver et la comparer plus tard.
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.simulations.map((simulation) => {
              const computed = scenarioValue(simulation.id);
              const isA = compare.a === simulation.id;
              const isB = compare.b === simulation.id;
              return (
                <article key={simulation.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold">
                        {simulation.label || 'Scénario'}
                      </p>
                      <p className="text-[12px] text-mist">
                        {formatPercent(num(simulation.annual_return) / 100, 1)} ·{' '}
                        {simulation.horizon_years} ans · {formatAmount(num(simulation.monthly_contribution), currency)}{' '}
                        /mois
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {(['a', 'b'] as const).map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() =>
                            setCompare((current) => ({
                              ...current,
                              [slot]: current[slot] === simulation.id ? null : simulation.id,
                            }))
                          }
                          aria-pressed={slot === 'a' ? isA : isB}
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-full border text-[12px] font-bold transition-colors',
                            (slot === 'a' ? isA : isB)
                              ? 'border-accent bg-accent text-ink'
                              : 'border-line text-mist hover:text-snow'
                          )}
                          aria-label={`Comparer ${simulation.label ?? 'ce scénario'} en ${slot.toUpperCase()}`}
                        >
                          {slot.toUpperCase()}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-mist transition-colors hover:bg-coral/10 hover:text-coral-text"
                        onClick={() => deleteSimulation.mutate(simulation.id)}
                        aria-label={`Supprimer ${simulation.label ?? 'le scénario'}`}
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <dt className="text-mist">Capital à l'horizon</dt>
                      <dd className="num mt-0.5 text-[14px] font-semibold">
                        {formatAmount(computed?.capital ?? 0, currency)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-mist">Besoins couverts</dt>
                      <dd className="num mt-0.5 text-[14px] font-semibold text-accent-text">
                        {formatPercent(Math.min(9.99, computed?.coverage ?? 0))}
                      </dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
        )}

        {compare.a && compare.b && compare.a !== compare.b ? (
          <div className="card mt-3 p-5">
            <p className="label">Comparaison A / B</p>
            <div className="mt-3 grid grid-cols-2 gap-4">
              {(['a', 'b'] as const).map((slot) => {
                const id = compare[slot];
                const computed = id ? scenarioValue(id) : null;
                return (
                  <div key={slot}>
                    <p className="text-[12px] font-semibold text-accent-text">{slot.toUpperCase()}</p>
                    <p className="mt-1 text-[14px] font-medium">
                      {computed?.scenario.label || 'Scénario'}
                    </p>
                    <p className="num mt-1 text-[18px] font-semibold">
                      {formatAmount(computed?.capital ?? 0, currency)}
                    </p>
                    <p className="text-[12px] text-mist">
                      {computed?.years === null || computed?.years === undefined
                        ? 'Liberté au-delà de 40 ans'
                        : `Liberté dans ${computed.years} ans`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      <p className="text-[12px] text-mist">
        Dernière actualisation possible à tout moment · Basé sur {monthLabel(currentMonthKey())}.
      </p>
    </div>
  );
}
