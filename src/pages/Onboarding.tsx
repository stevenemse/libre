import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Logo, FieldError, cn } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useSaveProfile } from '../lib/queries';
import { currencyLabel } from '../lib/format';
import { savings, savingsRate } from '../lib/calc';
import type { Profile } from '../lib/types';

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

const STEP_COUNT = 5;

export default function Onboarding({ profile }: { profile?: Profile }) {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const saveProfile = useSaveProfile(userId);

  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [currency, setCurrency] = useState(profile?.currency ?? 'XAF');
  const [income, setIncome] = useState(profile?.avg_income ? String(profile.avg_income) : '');
  const [needs, setNeeds] = useState(profile?.avg_needs ? String(profile.avg_needs) : '');
  const [goal, setGoal] = useState(profile?.life_goal ?? 'autonomie');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsedIncome = Number.parseFloat(income.replace(/\s/g, '').replace(',', '.')) || 0;
  const parsedNeeds = Number.parseFloat(needs.replace(/\s/g, '').replace(',', '.')) || 0;
  const estimate = useMemo(
    () => ({
      amount: savings(parsedIncome, parsedNeeds),
      rate: savingsRate(parsedIncome, parsedNeeds),
    }),
    [parsedIncome, parsedNeeds]
  );

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
    if (step === 3 && parsedNeeds <= 0) {
      setError('Indique le montant de tes besoins courants chaque mois.');
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
        avg_needs: parsedNeeds,
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

  const labels = ['Ton prénom', 'Ta devise', 'Tes revenus', 'Tes besoins', 'Ton objectif'];

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
                  index <= step ? 'bg-accent' : 'bg-white/10'
                )}
              />
            ))}
          </div>

          <div className="card fade-up p-6 sm:p-8" key={step}>
            <p className="text-[13px] font-medium uppercase tracking-wide text-mist">
              {labels[step]}
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
                          : 'border-white/8 bg-slate2/50 hover:bg-slate2'
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
                    aria-label="Revenus mensuels moyens"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-mist">
                    {currencyLabel(currency)}
                  </span>
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <h1 className="mt-2 text-[30px] leading-tight sm:text-[34px]">
                  Tes besoins courants
                </h1>
                <p className="mt-2 text-sm text-mist">
                  Loyer, nourriture, transport, santé, factures, scolarité. Ce qui est indispensable
                  chaque mois.
                </p>
                <div className="relative mt-6">
                  <input
                    className="field h-16 pr-24 text-[26px] font-semibold"
                    inputMode="decimal"
                    value={needs}
                    onChange={(event) => setNeeds(event.target.value)}
                    placeholder="0"
                    aria-label="Besoins courants mensuels"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-mist">
                    {currencyLabel(currency)}
                  </span>
                </div>
                {parsedIncome > 0 && parsedNeeds > parsedIncome ? (
                  <p className="mt-3 text-[13px] text-amber">
                    Tes besoins dépassent tes revenus actuels. C'est un point de départ, pas un
                    jugement : Libre va t'aider à voir où agir.
                  </p>
                ) : null}
              </>
            ) : null}

            {step === 4 ? (
              <>
                <h1 className="mt-2 text-[30px] leading-tight sm:text-[34px]">
                  Ton objectif de vie
                </h1>
                <p className="mt-2 text-sm text-mist">
                  Pourquoi tu construis cette liberté ? Cela orientera tes conseils.
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
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
                          : 'border-white/8 bg-slate2/50 hover:bg-slate2'
                      )}
                    >
                      <span className="block text-[14px] font-semibold">{option.label}</span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-mist">
                        {option.hint}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-5 rounded-3xl bg-accent p-5 text-ink">
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
                {step === STEP_COUNT - 1 ? (busy ? 'On prépare ton espace…' : 'Voir mon espace') : 'Continuer'}
                <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
