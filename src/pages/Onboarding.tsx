import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Logo, FieldError, cn } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useSaveProfile } from '../lib/queries';
import { currencyLabel, formatMoney } from '../lib/format';
import { needsBreakdownTotal, recurringNeedMonthly, savings, savingsRate } from '../lib/calc';
import type { NeedBasis, NeedsBreakdown, Profile } from '../lib/types';

const CURRENCIES = [
  { code: 'XAF', label: 'FCFA — Afrique centrale' },
  { code: 'XOF', label: "FCFA — Afrique de l'ouest" },
  { code: 'EUR', label: 'Euro' },
  { code: 'USD', label: 'Dollar américain' },
  { code: 'NGN', label: 'Naira' },
  { code: 'MAD', label: 'Dirham' },
];

const GOALS = [
  { key: 'autonomie', label: 'Autonomie', hint: "Ne plus dépendre d'un seul revenu" },
  { key: 'projet', label: 'Projet', hint: 'Lancer mon activité, acheter un outil' },
  { key: 'famille', label: 'Famille', hint: 'Protéger et soutenir les miens' },
  { key: 'retraite', label: 'Retraite anticipée', hint: 'Vivre de mes assets tôt' },
];

const STEP_COUNT = 7;
const LABELS = [
  'Ton prénom',
  'Ta devise',
  'Tes revenus',
  'Ton transport',
  'Ton alimentation',
  'Le reste',
  'Ton objectif',
];

const parseAmount = (value: string): number =>
  Number.parseFloat(value.replace(/\s/g, '').replace(',', '.')) || 0;

const toInput = (value: number | undefined | null): string =>
  value && value > 0 ? String(value) : '';

function MoneyInput({
  id,
  label,
  hint,
  value,
  onChange,
  currency,
  placeholder,
  autoFocus,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  currency: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className="field h-14 pr-16 text-[20px] font-semibold"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder ?? '0'}
          autoFocus={autoFocus}
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-mist">
          {currencyLabel(currency)}
        </span>
      </div>
      {hint ? <p className="mt-1.5 text-[12px] leading-snug text-mist">{hint}</p> : null}
    </div>
  );
}

function DaysInput({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className="field h-14 pr-16 text-[20px] font-semibold"
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-mist">
          jours
        </span>
      </div>
      {hint ? <p className="mt-1.5 text-[12px] leading-snug text-mist">{hint}</p> : null}
    </div>
  );
}

function BasisSwitch({ value, onChange }: { value: NeedBasis; onChange: (v: NeedBasis) => void }) {
  return (
    <div
      className="mt-4 grid grid-cols-2 gap-1 rounded-full border border-line bg-slate1/60 p-1"
      role="group"
      aria-label="Base du calcul"
    >
      {[
        { key: 'day' as const, label: 'Par jour' },
        { key: 'month' as const, label: 'Par mois' },
      ].map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          aria-pressed={value === option.key}
          className={cn(
            'rounded-full py-2 text-[13px] font-semibold transition-colors',
            value === option.key ? 'bg-accent text-ink' : 'text-mist hover:text-snow'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MonthlyLine({ amount, currency }: { amount: number; currency: string }) {
  return (
    <div className="mt-4 flex items-baseline justify-between gap-3 rounded-2xl bg-slate1/60 px-4 py-3">
      <span className="text-[13px] text-mist">Soit chaque mois</span>
      <span className="num text-[18px] font-semibold text-snow">{formatMoney(amount, currency)}</span>
    </div>
  );
}

export default function Onboarding({ profile }: { profile?: Profile }) {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const saveProfile = useSaveProfile(userId);

  const saved = (profile?.needs_breakdown ?? null) as Partial<NeedsBreakdown> | null;

  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [currency, setCurrency] = useState(profile?.currency ?? 'XAF');
  const [income, setIncome] = useState(profile?.avg_income ? String(profile.avg_income) : '');
  const [goal, setGoal] = useState(profile?.life_goal ?? 'autonomie');

  const [transportBasis, setTransportBasis] = useState<NeedBasis>(
    saved?.transport?.basis === 'month' ? 'month' : 'day'
  );
  const [transportAmount, setTransportAmount] = useState(toInput(saved?.transport?.unitAmount));
  const [transportDays, setTransportDays] = useState(
    saved?.transport?.basis === 'month' ? '' : String(saved?.transport?.days || 22)
  );

  const [foodBasis, setFoodBasis] = useState<NeedBasis>(saved?.food?.basis === 'month' ? 'month' : 'day');
  const [foodAmount, setFoodAmount] = useState(toInput(saved?.food?.unitAmount));
  const [foodDays, setFoodDays] = useState(
    saved?.food?.basis === 'month' ? '' : String(saved?.food?.days || 30)
  );

  const [rent, setRent] = useState(toInput(saved?.housing?.rent));
  const [bills, setBills] = useState(toInput(saved?.housing?.bills));
  const [other, setOther] = useState(toInput(saved?.housing?.other));

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsedIncome = parseAmount(income);

  const breakdown: NeedsBreakdown = useMemo(
    () => ({
      transport: {
        basis: transportBasis,
        unitAmount: parseAmount(transportAmount),
        days: transportBasis === 'day' ? parseAmount(transportDays) : 1,
      },
      food: {
        basis: foodBasis,
        unitAmount: parseAmount(foodAmount),
        days: foodBasis === 'day' ? parseAmount(foodDays) : 1,
      },
      housing: {
        rent: parseAmount(rent),
        bills: parseAmount(bills),
        other: parseAmount(other),
      },
    }),
    [transportBasis, transportAmount, transportDays, foodBasis, foodAmount, foodDays, rent, bills, other]
  );

  const needs = needsBreakdownTotal(breakdown);
  const estimate = useMemo(
    () => ({ amount: savings(parsedIncome, needs), rate: savingsRate(parsedIncome, needs) }),
    [parsedIncome, needs]
  );

  const checkPeriod = (label: string, days: string): string | null => {
    const parsed = parseAmount(days);
    if (parsed < 1) return `Indique combien de jours par mois tu as des frais de ${label}.`;
    if (parsed > 31) return `Il y a au plus 31 jours dans un mois : vérifie les ${label}.`;
    return null;
  };

  const next = async () => {
    setError(null);
    if (step === 0 && !firstName.trim()) {
      setError('Ton prénom nous aide à personnaliser ton espace.');
      return;
    }
    if (step === 2 && parsedIncome <= 0) {
      setError('Indique un revenu mensuel moyen, même approximatif.');
      return;
    }
    if (step === 3 && transportBasis === 'day' && parseAmount(transportAmount) > 0) {
      const periodError = checkPeriod('transport', transportDays);
      if (periodError) {
        setError(periodError);
        return;
      }
    }
    if (step === 4 && foodBasis === 'day' && parseAmount(foodAmount) > 0) {
      const periodError = checkPeriod('repas', foodDays);
      if (periodError) {
        setError(periodError);
        return;
      }
    }
    if (step === 5 && needs <= 0) {
      setError(
        "Indique au moins un besoin : transport, repas, logement ou une autre charge. C'est ce qui rend ton épargne réelle."
      );
      return;
    }
    if (step < STEP_COUNT - 1) {
      setStep(step + 1);
      return;
    }

    setBusy(true);
    try {
      await saveProfile.mutateAsync({
        first_name: firstName.trim(),
        currency,
        avg_income: parsedIncome,
        avg_needs: needs,
        needs_breakdown: breakdown,
        life_goal: goal,
        onboarded: true,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  const transportMonthly = recurringNeedMonthly(breakdown.transport);
  const foodMonthly = recurringNeedMonthly(breakdown.food);
  const housingMonthly = breakdown.housing.rent + breakdown.housing.bills + breakdown.housing.other;

  return (
    <div className="app-shell">
      <header className="container-app flex h-16 items-center justify-between">
        <Logo size={21} />
        <span className="text-[13px] text-mist">
          Étape {step + 1} sur {STEP_COUNT}
        </span>
      </header>

      <div className="container-app flex flex-1 flex-col justify-center pb-12">
        <div className="mx-auto w-full max-w-[560px]">
          <div className="mb-6 flex gap-1.5" aria-hidden="true">
            {Array.from({ length: STEP_COUNT }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors duration-300',
                  index <= step ? 'bg-accent' : 'bg-line'
                )}
              />
            ))}
          </div>

          <div className="card fade-up p-6 sm:p-8" key={step}>
            <p className="text-[13px] font-medium uppercase tracking-wide text-mist">
              {LABELS[step]}
            </p>

            {step === 0 ? (
              <>
                <h1 className="mt-2 text-[30px] leading-tight sm:text-[34px]">
                  Comment tu t'appelles ?
                </h1>
                <p className="mt-2 text-sm text-mist">
                  On utilise ton prénom pour te parler simplement.
                </p>
                <input
                  className="field mt-6 h-14 text-[18px]"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="Ton prénom"
                  autoFocus
                  maxLength={40}
                  aria-label="Prénom"
                />
              </>
            ) : null}

            {step === 1 ? (
              <>
                <h1 className="mt-2 text-[30px] leading-tight sm:text-[34px]">Ta devise</h1>
                <p className="mt-2 text-sm text-mist">
                  Tous tes montants s'afficheront dans cette devise. Modifiable plus tard.
                </p>
                <div className="mt-6 grid gap-2">
                  {CURRENCIES.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => setCurrency(option.code)}
                      aria-pressed={currency === option.code}
                      className={cn(
                        'flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors',
                        currency === option.code
                          ? 'border-accent bg-accent/10'
                          : 'border-line bg-slate2/50 hover:bg-slate2'
                      )}
                    >
                      <span>
                        <span className="block text-[15px] font-semibold">{option.label}</span>
                        <span className="text-[13px] text-mist">{currencyLabel(option.code)}</span>
                      </span>
                      {currency === option.code ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-ink">
                          <Check size={14} strokeWidth={3} aria-hidden="true" />
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <h1 className="mt-2 text-[30px] leading-tight sm:text-[34px]">
                  Tes revenus mensuels
                </h1>
                <p className="mt-2 text-sm text-mist">
                  Salaire, petits jobs, business, aide familiale : une moyenne suffit pour commencer.
                </p>
                <div className="relative mt-6">
                  <input
                    className="field h-16 pr-24 text-[26px] font-semibold"
                    inputMode="decimal"
                    value={income}
                    onChange={(event) => setIncome(event.target.value)}
                    placeholder="0"
                    autoFocus
                    aria-label="Revenus mensuels moyens"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-mist">
                    {currencyLabel(currency)}
                  </span>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-mist">
                  Tu n'as pas de revenu fixe ? Prends ce que tu as reçu le mois dernier, même si
                  c'était irrégulier.
                </p>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <h1 className="mt-2 text-[30px] leading-tight sm:text-[34px]">
                  Ton transport
                </h1>
                <p className="mt-2 text-sm text-mist">
                  On ne te demande pas un total : dis-nous juste ce que tu paies quand tu te
                  déplaces, et combien de jours par mois.
                </p>
                <BasisSwitch value={transportBasis} onChange={setTransportBasis} />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {transportBasis === 'day' ? (
                    <>
                      <MoneyInput
                        id="transport-day"
                        label="Un jour de déplacement"
                        hint="Aller-retour, taxi, bus, carburant…"
                        value={transportAmount}
                        onChange={setTransportAmount}
                        currency={currency}
                        autoFocus
                      />
                      <DaysInput
                        id="transport-days"
                        label="Jours par mois"
                        hint="Souvent 20 à 22 jours travaillés."
                        value={transportDays}
                        onChange={setTransportDays}
                      />
                    </>
                  ) : (
                    <div className="sm:col-span-2">
                      <MoneyInput
                        id="transport-month"
                        label="Transport par mois"
                        hint="Si tu connais déjà ton budget transport."
                        value={transportAmount}
                        onChange={setTransportAmount}
                        currency={currency}
                        autoFocus
                      />
                    </div>
                  )}
                </div>
                <MonthlyLine amount={transportMonthly} currency={currency} />
                <p className="mt-3 text-[12px] leading-relaxed text-mist">
                  Tu marches ou on t'emmène ? Laisse 0 : ce n'est pas une dépense pour toi.
                </p>
              </>
            ) : null}

            {step === 4 ? (
              <>
                <h1 className="mt-2 text-[30px] leading-tight sm:text-[34px]">
                  Et pour manger ?
                </h1>
                <p className="mt-2 text-sm text-mist">
                  Un repas au dehors, une part de courses, la cantine : une moyenne par jour suffit
                  pour obtenir un vrai chiffre.
                </p>
                <BasisSwitch value={foodBasis} onChange={setFoodBasis} />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {foodBasis === 'day' ? (
                    <>
                      <MoneyInput
                        id="food-day"
                        label="Repas et courses par jour"
                        hint="Ce que tu paies toi-même."
                        value={foodAmount}
                        onChange={setFoodAmount}
                        currency={currency}
                        autoFocus
                      />
                      <DaysInput
                        id="food-days"
                        label="Jours par mois"
                        hint="30 si tu manges tous les jours."
                        value={foodDays}
                        onChange={setFoodDays}
                      />
                    </>
                  ) : (
                    <div className="sm:col-span-2">
                      <MoneyInput
                        id="food-month"
                        label="Alimentation par mois"
                        hint="Si tu connais déjà ton budget repas."
                        value={foodAmount}
                        onChange={setFoodAmount}
                        currency={currency}
                        autoFocus
                      />
                    </div>
                  )}
                </div>
                <MonthlyLine amount={foodMonthly} currency={currency} />
                <p className="mt-3 text-[12px] leading-relaxed text-mist">
                  Tu manges chez tes parents ? Mets seulement ce que tu ajoutes toi-même.
                </p>
              </>
            ) : null}

            {step === 5 ? (
              <>
                <h1 className="mt-2 text-[30px] leading-tight sm:text-[34px]">
                  Logement et autres besoins
                </h1>
                <p className="mt-2 text-sm text-mist">
                  Loyer, factures, santé, scolarité, soutien à la famille. Laisse 0 pour ce que tu
                  ne paies pas.
                </p>
                <div className="mt-5 grid gap-4">
                  <MoneyInput
                    id="rent"
                    label="Loyer ou part du logement"
                    hint="0 si tu es hébergé sans participation."
                    value={rent}
                    onChange={setRent}
                    currency={currency}
                  />
                  <MoneyInput
                    id="bills"
                    label="Eau, électricité, internet, téléphone"
                    value={bills}
                    onChange={setBills}
                    currency={currency}
                  />
                  <MoneyInput
                    id="other"
                    label="Autres besoins indispensables"
                    hint="Santé, scolarité, transport d'un proche, assurance."
                    value={other}
                    onChange={setOther}
                    currency={currency}
                  />
                </div>

                <div className="mt-4 rounded-2xl bg-slate1/60 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] text-mist">Logement et charges</span>
                    <span className="num text-[15px] font-semibold">
                      {formatMoney(housingMonthly, currency)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2">
                    <span className="text-[13px] font-medium">Total de tes besoins</span>
                    <span className="num text-[18px] font-semibold text-snow">
                      {formatMoney(needs, currency)}
                    </span>
                  </div>
                </div>

                {parsedIncome > 0 && needs > parsedIncome ? (
                  <p className="mt-3 text-[13px] leading-relaxed text-amber-text">
                    Tes besoins dépassent tes revenus actuels. C'est un point de départ, pas un
                    jugement : Libre va t'aider à voir où agir.
                  </p>
                ) : null}
              </>
            ) : null}

            {step === 6 ? (
              <>
                <h1 className="mt-2 text-[30px] leading-tight sm:text-[34px]">
                  Ton objectif de vie
                </h1>
                <p className="mt-2 text-sm text-mist">
                  Pourquoi tu construis cette liberté ? Cela orientera tes conseils.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {GOALS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setGoal(option.key)}
                      aria-pressed={goal === option.key}
                      className={cn(
                        'rounded-2xl border p-3 text-left transition-colors',
                        goal === option.key
                          ? 'border-accent bg-accent/10'
                          : 'border-line bg-slate2/50 hover:bg-slate2'
                      )}
                    >
                      <span className="block text-[14px] font-semibold">{option.label}</span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-mist">
                        {option.hint}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-line bg-slate1/40 px-4 py-3">
                  <p className="text-[12px] font-medium uppercase tracking-wide text-mist">
                    Ton estimation
                  </p>
                  <dl className="mt-2 space-y-1.5 text-[13px]">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-mist">
                        Transport
                        {transportBasis === 'day' && parseAmount(transportAmount) > 0
                          ? ` · ${parseAmount(transportDays)} j`
                          : ''}
                      </dt>
                      <dd className="num">{formatMoney(transportMonthly, currency)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-mist">
                        Alimentation
                        {foodBasis === 'day' && parseAmount(foodAmount) > 0
                          ? ` · ${parseAmount(foodDays)} j`
                          : ''}
                      </dt>
                      <dd className="num">{formatMoney(foodMonthly, currency)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-mist">Logement et autres</dt>
                      <dd className="num">{formatMoney(housingMonthly, currency)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-t border-line pt-1.5">
                      <dt className="font-medium text-snow">Besoins par mois</dt>
                      <dd className="num font-semibold">{formatMoney(needs, currency)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-4 rounded-3xl bg-accent p-5 text-ink">
                  <p className="text-[13px] font-medium text-ink/70">Ton épargne estimée</p>
                  <p className="num mt-1 text-[34px] font-semibold leading-none">
                    {new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(
                      estimate.amount
                    )}{' '}
                    <span className="text-[15px] font-medium text-ink/70">
                      {currencyLabel(currency)} / mois
                    </span>
                  </p>
                  <p className="mt-2 text-[13px] text-ink/75">
                    Soit {Math.round(estimate.rate * 100)} % de tes revenus. Ton premier conseil
                    t'attend sur l'accueil.
                  </p>
                </div>
              </>
            ) : null}

            <FieldError>{error}</FieldError>

            <div className="mt-6 flex items-center gap-2">
              {step > 0 ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setStep(step - 1)}
                  aria-label="Étape précédente"
                >
                  <ArrowLeft size={16} strokeWidth={1.75} />
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={next}
                disabled={busy}
              >
                {step === STEP_COUNT - 1
                  ? busy
                    ? 'On prépare ton espace…'
                    : 'Voir mon espace'
                  : 'Continuer'}
                <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
