import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Compass, Download, LogOut, Trash2, UserRound } from 'lucide-react';
import { useTour } from '../components/AppShell';
import { useAuth } from '../lib/auth';
import {
  useDeleteAccount,
  useSaveEmergency,
  useSaveNotifications,
  useSaveProfile,
  useSavePushSubscription,
  useWorkspace,
} from '../lib/queries';
import { pushConfigured, subscribeToPush } from '../lib/push';
import { Alert, FieldError, ProgressBar, SectionTitle, Sheet, Toggle, cn } from '../components/ui';
import { currencyLabel, formatAmount, formatDate, formatMoney } from '../lib/format';
import { num, recurringNeedMonthly } from '../lib/calc';
import type { NeedsBreakdown } from '../lib/types';

const CURRENCIES = ['XAF', 'XOF', 'EUR', 'USD', 'NGN', 'MAD'];

export default function Settings() {
  const { userId, session, signOut } = useAuth();
  const { data } = useWorkspace(userId);
  const saveProfile = useSaveProfile(userId);
  const saveEmergency = useSaveEmergency(userId);
  const saveNotifications = useSaveNotifications(userId);
  const savePush = useSavePushSubscription(userId);
  const deleteAccount = useDeleteAccount();
  const { start: startTour } = useTour();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [income, setIncome] = useState('');
  const [needs, setNeeds] = useState('');
  const [rateGoal, setRateGoal] = useState(20);
  const [emergencyMonths, setEmergencyMonths] = useState(6);
  const [emergencyAmount, setEmergencyAmount] = useState('');
  const [emergencyTargetInput, setEmergencyTargetInput] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [notifState, setNotifState] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setFirstName(data.profile.first_name ?? '');
    setCurrency(data.profile.currency);
    setIncome(data.profile.avg_income ? String(data.profile.avg_income) : '');
    setNeeds(data.profile.avg_needs ? String(data.profile.avg_needs) : '');
    setRateGoal(num(data.profile.savings_rate_goal));
    setEmergencyMonths(data.profile.emergency_months);
    setEmergencyAmount(String(num(data.emergency.amount_saved)));
    setEmergencyTargetInput(
      data.emergency.target_amount != null ? String(num(data.emergency.target_amount)) : ''
    );
  }, [data]);

  if (!data) return null;

  const email = session?.user.email ?? '';
  const breakdown = (data.profile.needs_breakdown ?? null) as Partial<NeedsBreakdown> | null;
  const hasBreakdown = Boolean(breakdown?.transport || breakdown?.food || breakdown?.housing);
  const parseAmount = (value: string) =>
    Number.parseFloat(value.replace(/\s/g, '').replace(',', '.')) || 0;

  const download = (content: string, type: string, filename: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const header = 'date;type;categorie;montant;note;recurrence';
    const rows = data.transactions.map((tx) => {
      const category = data.categories.find((item) => item.id === tx.category_id);
      return [
        tx.occurred_on,
        tx.type,
        category?.name ?? '',
        num(tx.amount).toFixed(2),
        (tx.note ?? '').replace(/;/g, ','),
        tx.recurrence,
      ].join(';');
    });
    download([header, ...rows].join('\n'), 'text/csv;charset=utf-8', 'libre-transactions.csv');
  };

  const exportJson = () => {
    download(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          profile: data.profile,
          allocation: data.allocation,
          emergencyFund: data.emergency,
          categories: data.categories.filter((category) => category.user_id === userId),
          transactions: data.transactions,
          assets: data.assets,
          goals: data.goals,
          simulations: data.simulations,
          protection: data.protection,
          tipsProgress: data.progress,
        },
        null,
        2
      ),
      'application/json',
      'libre-donnees.json'
    );
  };

  const enableNotifications = async () => {
    setPushBusy(true);
    setNotifState(null);
    try {
      const subscription = await subscribeToPush();
      await savePush.mutateAsync(subscription);
      setNotifState(
        'Rappels activés sur cet appareil. Le bilan hebdomadaire et le résumé mensuel arrivent à l’heure choisie.'
      );
    } catch (err) {
      setNotifState(err instanceof Error ? err.message : 'Activation impossible.');
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div className="fade-up space-y-6">
      <header>
        <p className="label">Paramètres</p>
        <h1 className="mt-1 text-[30px] leading-tight sm:text-[38px]">Ton compte</h1>
        <p className="mt-1 text-[13px] text-mist">{email}</p>
      </header>

      <section className="card p-5 sm:p-6">
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <UserRound size={18} strokeWidth={1.75} /> Profil
          </span>
        </SectionTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="settings-name" className="field-label">
              Prénom
            </label>
            <input
              id="settings-name"
              className="field"
              value={firstName}
              onChange={(event) => {
                setFirstName(event.target.value);
                setSaved(false);
              }}
              maxLength={40}
            />
          </div>
          <div>
            <label htmlFor="settings-currency" className="field-label">
              Devise
            </label>
            <select
              id="settings-currency"
              className="field appearance-none"
              value={currency}
              onChange={(event) => {
                setCurrency(event.target.value);
                setSaved(false);
              }}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code} — {currencyLabel(code)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="settings-income" className="field-label">
              Revenus mensuels moyens
            </label>
            <input
              id="settings-income"
              className="field"
              inputMode="decimal"
              value={income}
              onChange={(event) => {
                setIncome(event.target.value);
                setSaved(false);
              }}
              placeholder="0"
            />
          </div>
          <div>
            <label htmlFor="settings-needs" className="field-label">
              Besoins courants par mois
            </label>
            <input
              id="settings-needs"
              className="field"
              inputMode="decimal"
              value={needs}
              onChange={(event) => {
                setNeeds(event.target.value);
                setSaved(false);
              }}
              placeholder="0"
            />
          </div>
        </div>

        {hasBreakdown ? (
          <div className="mt-4 rounded-2xl bg-slate1/50 px-4 py-3">
            <p className="text-[12px] font-medium uppercase tracking-wide text-mist">
              Détail de ton estimation
            </p>
            <dl className="mt-2 space-y-1 text-[13px] text-mist">
              {breakdown?.transport ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt>Transport</dt>
                  <dd className="num">
                    {formatMoney(recurringNeedMonthly(breakdown.transport), currency)}
                  </dd>
                </div>
              ) : null}
              {breakdown?.food ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt>Alimentation</dt>
                  <dd className="num">{formatMoney(recurringNeedMonthly(breakdown.food), currency)}</dd>
                </div>
              ) : null}
              {breakdown?.housing ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt>Logement et autres</dt>
                  <dd className="num">
                    {formatMoney(
                      num(breakdown.housing.rent) +
                        num(breakdown.housing.bills) +
                        num(breakdown.housing.other),
                      currency
                    )}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}

        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="settings-rate" className="text-[14px] font-medium">
              Objectif de taux d'épargne
            </label>
            <span className="num shrink-0 text-[14px] font-semibold">{Math.round(rateGoal)} %</span>
          </div>
          <input
            id="settings-rate"
            type="range"
            min={5}
            max={50}
            step={5}
            value={rateGoal}
            onChange={(event) => {
              setRateGoal(Number(event.target.value));
              setSaved(false);
            }}
            className="mt-2"
          />
        </div>

        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="settings-months" className="text-[14px] font-medium">
              Mois de besoins couverts par le fonds d'urgence
            </label>
            <span className="num shrink-0 text-[14px] font-semibold">{emergencyMonths} mois</span>
          </div>
          <input
            id="settings-months"
            type="range"
            min={3}
            max={12}
            step={1}
            value={emergencyMonths}
            onChange={(event) => {
              setEmergencyMonths(Number(event.target.value));
              setSaved(false);
            }}
            className="mt-2"
          />
        </div>

        <div className="mt-5">
          <label htmlFor="settings-emergency-amount" className="field-label">
            Montant déjà constitué dans le fonds d'urgence
          </label>
          <div className="relative">
            <input
              id="settings-emergency-amount"
              className="field pr-20"
              inputMode="decimal"
              value={emergencyAmount}
              onChange={(event) => {
                setEmergencyAmount(event.target.value);
                setSaved(false);
              }}
              placeholder="0"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12px] text-mist">
              {currencyLabel(currency)}
            </span>
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor="settings-emergency-target" className="field-label">
            Cible du fonds d'urgence (palier)
          </label>
          <div className="relative">
            <input
              id="settings-emergency-target"
              className="field pr-20"
              inputMode="decimal"
              value={emergencyTargetInput}
              onChange={(event) => {
                setEmergencyTargetInput(event.target.value);
                setSaved(false);
              }}
              placeholder="0"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12px] text-mist">
              {currencyLabel(currency)}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-mist">
            Laisse vide pour garder le calcul automatique ({formatAmount((parseAmount(needs) > 0 ? parseAmount(needs) : num(data.profile.avg_needs)) * emergencyMonths, currency)} ={' '}
            {emergencyMonths} × tes besoins). Modifie ce palier si tu vises un montant précis.
          </p>
        </div>

        {(() => {
          const monthlyNeeds = parseAmount(needs) > 0 ? parseAmount(needs) : num(data.profile.avg_needs);
          const customTarget = parseAmount(emergencyTargetInput);
          const target =
            emergencyTargetInput.trim() !== '' && customTarget > 0
              ? customTarget
              : monthlyNeeds * emergencyMonths;
          const savedAmt = Math.max(
            parseAmount(emergencyAmount),
            data.goals
              .filter((goal) => goal.pocket === 'protection' || /urgence/i.test(goal.name))
              .reduce((sum, goal) => sum + num(goal.current_amount), 0)
          );
          const progress = target > 0 ? Math.min(1, savedAmt / target) : 0;
          const monthsCovered = monthlyNeeds > 0 ? savedAmt / monthlyNeeds : 0;
          let status = 'À constituer';
          let tone = 'text-mist';
          if (target <= 0) {
            status = 'Renseigne tes besoins pour calculer la cible.';
          } else if (savedAmt >= target) {
            status = `Fonds complet — ${monthsCovered.toFixed(1)} mois de besoins couverts. Tu peux passer à l'étape suivante.`;
            tone = 'text-accent-text';
          } else if (progress >= 0.5) {
            status = `En bonne voie — encore ${formatAmount(target - savedAmt, currency)} à constituer.`;
            tone = 'text-ink';
          } else if (progress >= 0.25) {
            status = `Insuffisant — ${monthsCovered.toFixed(1)} mois couverts, vise ${emergencyMonths}.`;
            tone = 'text-coral-text';
          } else {
            status = `À constituer — commence petit mais régulier (${monthsCovered.toFixed(1)} mois couverts).`;
            tone = 'text-coral-text';
          }
          return (
            <div className="mt-4 rounded-2xl bg-slate1/50 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[12px] font-medium uppercase tracking-wide text-mist">
                  État du fonds
                </p>
                <p className={`text-[12px] font-semibold ${tone}`}>{status}</p>
              </div>
              <ProgressBar value={progress} height={6} />
              <div className="mt-2 flex justify-between text-[12px] text-mist">
                <span>
                  {formatAmount(savedAmt, currency)} / {formatAmount(target, currency)}
                </span>
                <span>{Math.round(progress * 100)} %</span>
              </div>
            </div>
          );
        })()}

        <FieldError>{error}</FieldError>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              setError(null);
              try {
                if (parseAmount(income) <= 0) {
                  setError('Indique un revenu mensuel moyen, même approximatif.');
                  return;
                }
                await saveProfile.mutateAsync({
                  first_name: firstName.trim(),
                  currency,
                  avg_income: parseAmount(income),
                  avg_needs: parseAmount(needs),
                  savings_rate_goal: rateGoal,
                  emergency_months: emergencyMonths,
                });
                await saveEmergency.mutateAsync({
                  amount: Math.max(0, parseAmount(emergencyAmount)),
                  target:
                    emergencyTargetInput.trim() === ''
                      ? null
                      : Math.max(0, parseAmount(emergencyTargetInput)),
                });
                setSaved(true);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
              }
            }}
          >
            {saved ? 'Enregistré' : 'Enregistrer'}
          </button>
          {saved ? <span className="text-[12px] text-mist">Tes préférences sont à jour.</span> : null}
        </div>
      </section>

      <section data-tour="notifications" className="card p-5 sm:p-6">
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <Bell size={18} strokeWidth={1.75} /> Notifications
          </span>
        </SectionTitle>

        <div className="divide-y divide-line">
          <Toggle
            label="Rappel de saisie"
            description="Un rappel quotidien pour noter tes dépenses."
            checked={data.notifications.daily_reminder}
            onChange={(next) => saveNotifications.mutate({ daily_reminder: next })}
          />
          <Toggle
            label="Rappel de versement d'épargne"
            description="Le jour de ta paie, mets ton épargne de côté."
            checked={data.notifications.payday_reminder}
            onChange={(next) => saveNotifications.mutate({ payday_reminder: next })}
          />
          <Toggle
            label="Alerte de dépassement"
            description="Quand tes besoins dépassent tes revenus."
            checked={data.notifications.budget_alert}
            onChange={(next) => saveNotifications.mutate({ budget_alert: next })}
          />
          <Toggle
            label="Bilan hebdomadaire"
            description="Chaque lundi, ce que tu as gagné, dépensé et gardé la semaine passée."
            checked={data.notifications.weekly_review}
            onChange={(next) => saveNotifications.mutate({ weekly_review: next })}
          />
          <Toggle
            label="Résumé mensuel"
            description="Un bilan simple au début de chaque mois."
            checked={data.notifications.monthly_summary}
            onChange={(next) => saveNotifications.mutate({ monthly_summary: next })}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label htmlFor="reminder-hour" className="text-[13px] text-mist">
            Heure des rappels
          </label>
          <select
            id="reminder-hour"
            className="field h-11 w-auto appearance-none pr-8 text-[13px]"
            value={data.notifications.reminder_hour}
            onChange={(event) =>
              saveNotifications.mutate({ reminder_hour: Number(event.target.value) })
            }
          >
            {Array.from({ length: 15 }, (_, index) => index + 7).map((hour) => (
              <option key={hour} value={hour}>
                {String(hour).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="btn btn-secondary mt-4"
          onClick={enableNotifications}
          disabled={pushBusy}
        >
          {pushBusy ? 'Activation…' : 'Activer les rappels sur cet appareil'}
        </button>
        {notifState ? (
          <p className="mt-2 text-[12px] leading-relaxed text-mist" role="status">
            {notifState}
          </p>
        ) : null}
        <p className="mt-2 text-[12px] leading-relaxed text-mist">
          {pushConfigured
            ? 'Les rappels passent par le navigateur et par e-mail quand ils sont actifs. Tu peux les couper à tout moment.'
            : 'Les rappels navigateur et e-mail nécessitent la configuration serveur (clé VAPID et fonction notify). Tant qu’elle manque, les réglages sont enregistrés mais rien n’est envoyé.'}
        </p>
      </section>

      <section className="card p-5 sm:p-6">
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <Compass size={18} strokeWidth={1.75} /> Guide de démarrage
          </span>
        </SectionTitle>
        <p className="max-w-[65ch] text-[13px] leading-relaxed text-mist">
          La visite guidée présente chaque écran et ce qu'il sert à faire. Elle s'ouvre une seule
          fois après l'inscription, puis reste disponible ici.
        </p>
        <button type="button" className="btn btn-secondary mt-4" onClick={() => startTour()}>
          <Compass size={15} strokeWidth={1.75} /> Revoir la visite guidée
        </button>
      </section>

      <section className="card p-5 sm:p-6">
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <Download size={18} strokeWidth={1.75} /> Tes données
          </span>
        </SectionTitle>
        <p className="max-w-[65ch] text-[13px] leading-relaxed text-mist">
          Libre est à toi : exporte ou supprime tout, quand tu veux. Aucune donnée n'est vendue et
          aucune publicité n'est affichée.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" onClick={exportCsv}>
            <Download size={15} strokeWidth={1.75} /> Export CSV
          </button>
          <button type="button" className="btn btn-secondary" onClick={exportJson}>
            <Download size={15} strokeWidth={1.75} /> Export JSON
          </button>
          <button
            type="button"
            className="btn btn-ghost text-coral-text"
            onClick={() => {
              setDeleteOpen(true);
              setDeleteConfirmed(false);
            }}
          >
            <Trash2 size={15} strokeWidth={1.75} /> Supprimer mon compte
          </button>
        </div>

        <p className="mt-4 text-[12px] text-mist">
          Compte créé le {formatDate(data.profile.created_at.slice(0, 10))} ·{' '}
          {data.transactions.length} transaction(s) enregistrée(s).
        </p>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold">Déconnexion</p>
            <p className="text-[12px] text-mist">Tes données restent en sécurité sur ton compte.</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              await signOut();
              navigate('/connexion', { replace: true });
            }}
          >
            <LogOut size={15} strokeWidth={1.75} /> Se déconnecter
          </button>
        </div>
      </section>

      <p className="text-[12px] leading-relaxed text-mist">
        Libre est un outil pédagogique de suivi et de simulation. Il ne détient pas d'argent, ne
        réalise aucune transaction et ne délivre pas de conseil en investissement réglementé.
      </p>

      <Sheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Supprimer ton compte"
        subtitle="Cette action est définitive."
      >
        <Alert tone="danger" title="Toutes tes données seront effacées">
          Transactions, épargne, assets, simulations et conseils lus. Aucune récupération possible.
        </Alert>

        <div className="mt-4">
          <label className="flex items-start gap-3 text-[13px] text-mist">
            <input
              type="checkbox"
              className={cn('mt-1 h-4 w-4 accent-[#FF5C5C]')}
              checked={deleteConfirmed}
              onChange={(event) => setDeleteConfirmed(event.target.checked)}
            />
            Je comprends que mon compte et mes données seront supprimés définitivement.
          </label>
        </div>

        <button
          type="button"
          className="btn mt-5 w-full bg-coral text-ink"
          disabled={!deleteConfirmed || deleteAccount.isPending}
          onClick={async () => {
            await deleteAccount.mutateAsync();
            await signOut();
            navigate('/connexion', { replace: true });
          }}
        >
          {deleteAccount.isPending ? 'Suppression…' : 'Supprimer définitivement'}
        </button>
      </Sheet>
    </div>
  );
}
