import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BadgeCheck,
  Database,
  Power,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useAdminPanel, useMaintenance, useSetMaintenance, useWorkspace } from '../lib/queries';
import { Alert, PageSkeleton, SectionTitle, Toggle, cn } from '../components/ui';
import { formatDate } from '../lib/format';

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: typeof Users;
}) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="label">{label}</p>
        <Icon size={16} strokeWidth={1.75} className="shrink-0 text-mist" aria-hidden="true" />
      </div>
      <p className="num mt-2 text-[26px] font-semibold leading-none">{value}</p>
      {hint ? <p className="mt-1.5 text-[12px] text-mist">{hint}</p> : null}
    </div>
  );
}

function CheckRow({ label, value, ok }: { label: string; value: number; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
      <span className="text-[13px] text-mist">{label}</span>
      <span
        className={cn(
          'num rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
          ok ? 'bg-accent/15 text-accent-text' : 'bg-coral/15 text-coral-text'
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default function Admin() {
  const { userId, session } = useAuth();
  const { data: workspace } = useWorkspace(userId);
  const isAdmin = workspace?.profile.is_admin ?? false;

  const { data, isLoading, error, refetch, isFetching } = useAdminPanel(isAdmin);
  const { data: maintenanceActive } = useMaintenance();
  const setMaintenance = useSetMaintenance();

  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!workspace) return <PageSkeleton />;

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <ShieldCheck size={28} strokeWidth={1.5} className="mx-auto text-mist" aria-hidden="true" />
        <h1 className="mt-3 text-[24px]">Accès réservé</h1>
        <p className="mt-2 text-sm text-mist">
          Cette page est réservée à l’opérateur du projet. Ton compte n’a pas le rôle
          administrateur.
        </p>
        <Link to="/" className="btn btn-secondary mt-5">
          Retour à l’accueil
        </Link>
      </div>
    );
  }

  if (isLoading || !data) {
    if (error) {
      return (
        <Alert tone="danger" title="Chargement impossible">
          {error instanceof Error ? error.message : 'Réessaie dans un instant.'}
        </Alert>
      );
    }
    return <PageSkeleton />;
  }

  const { overview, accounts, health } = data;
  const healthChecks: Array<{ label: string; value: number; ok: boolean }> = [
    { label: 'Profils sans répartition', value: health.profilesWithoutAllocation, ok: health.profilesWithoutAllocation === 0 },
    { label: 'Profils sans fonds d’urgence', value: health.profilesWithoutEmergencyFund, ok: health.profilesWithoutEmergencyFund === 0 },
    { label: 'Profils sans réglages de rappel', value: health.profilesWithoutNotifications, ok: health.profilesWithoutNotifications === 0 },
    { label: 'Profils non finalisés', value: health.profilesNotOnboarded, ok: health.profilesNotOnboarded === 0 },
    { label: 'Transactions sans catégorie', value: health.transactionsWithoutCategory, ok: health.transactionsWithoutCategory === 0 },
    { label: 'Transactions orphelines', value: health.orphanTransactions, ok: health.orphanTransactions === 0 },
    { label: 'Conseils publiés', value: health.tipsPublished, ok: health.tipsPublished > 0 },
    { label: 'Défis disponibles', value: health.challenges, ok: health.challenges > 0 },
  ];

  return (
    <div className="fade-up space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Administration</p>
          <h1 className="mt-1 text-[30px] leading-tight sm:text-[38px]">Vue d’ensemble</h1>
          <p className="mt-1 text-[13px] text-mist">{session?.user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            {isFetching ? 'Actualisation…' : 'Actualiser'}
          </button>
          <Link to="/" className="btn btn-ghost">
            Retour à l’app
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Users}
          label="Comptes inscrits"
          value={overview.accounts}
          hint={`${overview.new7} cette semaine · ${overview.new30} ce mois`}
        />
        <Stat
          icon={Activity}
          label="Actifs (30 j)"
          value={overview.active30}
          hint={`${overview.transactions30} transactions sur 30 j`}
        />
        <Stat
          icon={BadgeCheck}
          label="Comptes finalisés"
          value={overview.onboarded}
          hint={`${overview.confirmed} e-mails confirmés`}
        />
        <Stat
          icon={Database}
          label="Volume en base"
          value={overview.transactions}
          hint={`${overview.assets} assets · ${overview.pushDevices} appareils push`}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="card p-5 sm:p-6">
          <SectionTitle>
            <span className="inline-flex items-center gap-2">
              <Users size={18} strokeWidth={1.75} /> Comptes
            </span>
          </SectionTitle>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wide text-mist">
                  <th className="py-2 pr-3 font-medium">Compte</th>
                  <th className="py-2 pr-3 font-medium">Inscrit</th>
                  <th className="py-2 pr-3 font-medium">Activité</th>
                  <th className="py-2 pr-3 text-right font-medium">Trans.</th>
                  <th className="py-2 text-right font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="border-b border-line last:border-0">
                    <td className="py-3 pr-3">
                      <p className="text-[13px] font-medium">{account.email ?? '—'}</p>
                      <p className="text-[12px] text-mist">
                        {account.first_name || 'Sans prénom'} · {account.currency}
                        {account.is_admin ? ' · admin' : ''}
                      </p>
                    </td>
                    <td className="num py-3 pr-3 text-[12px] text-mist">
                      {formatDate(account.created_at.slice(0, 10))}
                    </td>
                    <td className="num py-3 pr-3 text-[12px] text-mist">
                      {account.last_activity ? formatDate(account.last_activity) : 'Aucune'}
                    </td>
                    <td className="num py-3 pr-3 text-right text-[13px]">{account.transactions}</td>
                    <td className="py-3 text-right">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          account.onboarded
                            ? 'bg-accent/15 text-accent-text'
                            : 'bg-amber/15 text-amber-text'
                        )}
                      >
                        {account.onboarded ? 'Actif' : 'En cours'}
                      </span>
                    </td>
                  </tr>
                ))}
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[13px] text-mist">
                      Aucun compte pour le moment.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-4">
          <section className="card p-5 sm:p-6">
            <SectionTitle>
              <span className="inline-flex items-center gap-2">
                <Wrench size={18} strokeWidth={1.75} /> Pause / réparation
              </span>
            </SectionTitle>

            <p className="text-[13px] leading-relaxed text-mist">
              Le mode maintenance affiche un bandeau à tous les utilisateurs. Les données restent
              lisibles, rien n’est supprimé.
            </p>

            <div className="mt-3 rounded-2xl bg-slate1/50 p-2">
              <Toggle
                label="Mode maintenance"
                description={
                  maintenanceActive
                    ? 'Actif : un bandeau est visible dans l’app.'
                    : 'Inactif : l’app fonctionne normalement.'
                }
                checked={Boolean(maintenanceActive)}
                onChange={async (next) => {
                  setFeedback(null);
                  try {
                    await setMaintenance.mutateAsync({ active: next, message });
                    setFeedback(next ? 'Maintenance activée.' : 'Maintenance coupée.');
                  } catch (err) {
                    setFeedback(err instanceof Error ? err.message : 'Action impossible.');
                  }
                }}
              />
            </div>

            <label htmlFor="admin-message" className="field-label mt-3">
              Message affiché
            </label>
            <input
              id="admin-message"
              className="field"
              value={message}
              maxLength={160}
              placeholder="Ex. Interventions en cours, tes données restent en sécurité."
              onChange={(event) => setMessage(event.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary mt-3"
              disabled={setMaintenance.isPending || !message.trim()}
              onClick={async () => {
                setFeedback(null);
                try {
                  await setMaintenance.mutateAsync({
                    active: Boolean(maintenanceActive),
                    message: message.trim(),
                  });
                  setFeedback('Message enregistré.');
                } catch (err) {
                  setFeedback(err instanceof Error ? err.message : 'Action impossible.');
                }
              }}
            >
              <Power size={15} strokeWidth={1.75} /> Enregistrer le message
            </button>

            {feedback ? (
              <p className="mt-2 text-[12px] text-mist" role="status">
                {feedback}
              </p>
            ) : null}
          </section>

          <section className="card p-5 sm:p-6">
            <SectionTitle>
              <span className="inline-flex items-center gap-2">
                <Database size={18} strokeWidth={1.75} /> Contrôle de la base
              </span>
            </SectionTitle>
            <div>
              {healthChecks.map((check) => (
                <CheckRow key={check.label} {...check} />
              ))}
            </div>
          </section>
        </div>
      </div>

      <section className="card p-5 sm:p-6">
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck size={18} strokeWidth={1.75} /> Accès
          </span>
        </SectionTitle>
        <p className="text-[13px] leading-relaxed text-mist">
          Le rôle administrateur est stocké dans <code>profiles.is_admin</code> et vérifié en base
          par chaque fonction du panel. Aucun client ne peut se l’accorder lui-même, et les agrégats
          ne contiennent aucune transaction individuelle.
        </p>
        <p className="mt-3 text-[12px] text-mist">
          Opérateur : {overview.admins} compte{overview.admins > 1 ? 's' : ''} avec ce rôle. Pour
          nommer un autre opérateur :{' '}
          <code>
            update profiles set is_admin = true where id = (select id from auth.users where email =
            '…');
          </code>
        </p>
        <p className="mt-3 text-[12px] text-mist">
          Ton profil est bien reconnu comme administrateur par la base.
        </p>
      </section>
    </div>
  );
}
