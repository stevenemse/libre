import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Download, LogOut, Trash2, UserRound } from 'lucide-react';
import { useAuth } from '../lib/auth';
import {
  useDeleteAccount,
  useSaveNotifications,
  useSaveProfile,
  useWorkspace,
} from '../lib/queries';
import { Alert, FieldError, SectionTitle, Sheet, Toggle, cn } from '../components/ui';
import { currencyLabel, formatDate } from '../lib/format';
import { num } from '../lib/calc';

const CURRENCIES = ['XAF', 'XOF', 'EUR', 'USD', 'NGN', 'MAD'];

export default function Settings() {
  const { userId, session, signOut } = useAuth();
  const { data } = useWorkspace(userId);
  const saveProfile = useSaveProfile(userId);
  const saveNotifications = useSaveNotifications(userId);
  const deleteAccount = useDeleteAccount();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [rateGoal, setRateGoal] = useState(20);
  const [emergencyMonths, setEmergencyMonths] = useState(6);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [notifState, setNotifState] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setFirstName(data.profile.first_name ?? '');
    setCurrency(data.profile.currency);
    setRateGoal(num(data.profile.savings_rate_goal));
    setEmergencyMonths(data.profile.emergency_months);
  }, [data]);

  if (!data) return null;

  const email = session?.user.email ?? '';

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
    if (!('Notification' in window)) {
      setNotifState('Ton navigateur ne prend pas en charge les notifications.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setNotifState('Notifications refusées. Tu peux changer ça dans les réglages du navigateur.');
      return;
    }
    setNotifState("Notifications autorisées. Les rappels arrivent quand l'application est ouverte.");
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

        <FieldError>{error}</FieldError>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              setError(null);
              try {
                await saveProfile.mutateAsync({
                  first_name: firstName.trim(),
                  currency,
                  savings_rate_goal: rateGoal,
                  emergency_months: emergencyMonths,
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

      <section className="card p-5 sm:p-6">
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <Bell size={18} strokeWidth={1.75} /> Notifications
          </span>
        </SectionTitle>

        <div className="divide-y divide-white/8">
          <Toggle
            label="Rappel de saisie"
            description="Un rappel quotidien pour noter tes dépenses."
            checked={data.notifications.daily_reminder}
            onChange={(next) => saveNotifications.mutate({ daily_reminder: next })}
          />
          <Toggle
            label="Rappel de versement d''épargne"
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
            label="Résumé mensuel"
            description="Un bilan simple au début de chaque mois."
            checked={data.notifications.monthly_summary}
            onChange={(next) => saveNotifications.mutate({ monthly_summary: next })}
          />
        </div>

        <button type="button" className="btn btn-secondary mt-4" onClick={enableNotifications}>
          Autoriser les notifications du navigateur
        </button>
        {notifState ? <p className="mt-2 text-[12px] text-mist">{notifState}</p> : null}
      </section>

      <section className="card p-5 sm:p-6">
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <Download size={18} strokeWidth={1.75} /> Tes données
          </span>
        </SectionTitle>
        <p className="max-w-[65ch] text-[13px] leading-relaxed text-mist">
          Libre est à toi : exporte ou supprime tout, quand tu veux. Aucune donnée n''est vendue et
          aucune publicité n''est affichée.
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
            className="btn btn-ghost text-coral"
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
        Libre est un outil pédagogique de suivi et de simulation. Il ne détient pas d''argent, ne
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
