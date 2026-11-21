import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Compass,
  Flame,
  PiggyBank,
  ShieldCheck,
  Target,
  TrendingUp,
  X,
  type LucideIcon,
} from 'lucide-react';
import { ProgressBar, cn } from './ui';
import { currencyLabel, formatAmount } from '../lib/format';
import type { DebtBoss, GameLevel, GameStats } from '../lib/game';

const BADGE_ICONS: Record<string, LucideIcon> = {
  'first-step': Award,
  reader: BookOpen,
  streak: Flame,
  shield: ShieldCheck,
  saver: PiggyBank,
  investor: TrendingUp,
  'debt-slayer': Target,
  free: Compass,
};

export function GameCard({
  stats,
  userId,
  onAddTransaction,
}: {
  stats: GameStats;
  userId: string | undefined;
  onAddTransaction: () => void;
}) {
  const [levelUp, setLevelUp] = useState<GameLevel | null>(null);
  const unlocked = stats.badges.filter((badge) => badge.unlocked).length;

  // Une célébration locale, uniquement quand le niveau vient de monter.
  useEffect(() => {
    if (!userId) return;
    const key = `libre:game-level:${userId}`;
    const stored = Number(window.localStorage.getItem(key) || 0);
    if (stored > 0 && stats.level.index > stored) setLevelUp(stats.level);
    window.localStorage.setItem(key, String(stats.level.index));
  }, [stats.level.index, stats.level.name, userId]);

  useEffect(() => {
    if (!levelUp) return;
    const timer = window.setTimeout(() => setLevelUp(null), 6500);
    return () => window.clearTimeout(timer);
  }, [levelUp]);

  const nextLabel = stats.next
    ? stats.nextLocked
      ? 'Jalon à débloquer'
      : `${Math.max(0, stats.next.xp - stats.xp)} XP avant ${stats.next.name}`
    : 'Sommet atteint';

  return (
    <>
      <section
        data-tour="next-action"
        className="card relative overflow-hidden p-5 sm:p-6"
        aria-labelledby="game-level-title"
      >
        <div
          className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-[19px] font-extrabold text-ink">
              {stats.level.index}
            </span>
            <div>
              <p className="label">Ton parcours</p>
              <h2 id="game-level-title" className="mt-0.5 text-[24px] leading-tight">
                Niveau {stats.level.index} · {stats.level.name}
              </h2>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate2 px-3 py-1.5 text-[12px] font-medium text-mist">
            <Flame size={14} strokeWidth={2} className="text-amber-text" aria-hidden="true" />
            {stats.streak} jour{stats.streak > 1 ? 's' : ''} de série
          </span>
        </div>

        <div className="relative mt-4">
          <ProgressBar
            value={stats.levelProgress}
            height={10}
            ariaLabel={`Progression du niveau ${stats.level.index}`}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-mist">
            <span>{stats.xp} XP</span>
            <span>{nextLabel}</span>
          </div>
          {stats.nextLocked && stats.next ? (
            <p className="mt-2 text-[12px] font-medium text-amber-text">
              Jalon manquant : {stats.next.requirement}.
            </p>
          ) : null}
        </div>

        <div className="relative mt-5 rounded-2xl border border-accent/25 bg-accent/8 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-accent-text">
                Quête du jour
              </p>
              <p className="mt-1 text-[16px] font-semibold">{stats.quest.title}</p>
            </div>
            {stats.quest.xp > 0 ? (
              <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-ink">
                +{stats.quest.xp} XP
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 max-w-[65ch] text-[13px] leading-relaxed text-mist">
            {stats.quest.body}
          </p>
          <div className="mt-4">
            {stats.quest.done ? (
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-accent-text">
                <CheckCircle2 size={17} strokeWidth={2} aria-hidden="true" />
                Fait pour aujourd’hui
              </span>
            ) : stats.quest.cta.action === 'transaction' ? (
              <button type="button" className="btn btn-primary h-11 text-[13px]" onClick={onAddTransaction}>
                {stats.quest.cta.label}
                <ArrowRight size={15} strokeWidth={2} />
              </button>
            ) : (
              <Link to={stats.quest.cta.to ?? '/'} className="btn btn-primary h-11 text-[13px]">
                {stats.quest.cta.label}
                <ArrowRight size={15} strokeWidth={2} />
              </Link>
            )}
          </div>
        </div>

        <div className="relative mt-5">
          {/* marge droite sur mobile : le bouton d'ajout flottant masquait le compteur. */}
          <div className="flex items-center justify-between gap-2 pr-16 lg:pr-0">
            <p className="label">Collection</p>
            <span className="text-[12px] text-mist">
              {unlocked}/{stats.badges.length} badges
            </span>
          </div>
          <ul className="hide-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="Badges du parcours">
            {stats.badges.map((badge) => {
              const Icon = BADGE_ICONS[badge.key] ?? Award;
              return (
                <li
                  key={badge.key}
                  title={badge.description}
                  className={cn(
                    'flex min-w-[78px] flex-col items-center gap-1.5 rounded-2xl border px-2.5 py-3 text-center',
                    badge.unlocked
                      ? 'border-accent/30 bg-accent/8'
                      : 'border-line opacity-60 grayscale'
                  )}
                >
                  <Icon
                    size={17}
                    strokeWidth={1.75}
                    className={badge.unlocked ? 'text-accent-text' : 'text-mist'}
                    aria-hidden="true"
                  />
                  <span className="text-[11px] font-semibold leading-tight">{badge.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {levelUp ? (
        <div
          className="fade-up fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-accent/40 bg-slate1 p-4 shadow-2xl lg:bottom-6"
          role="status"
          aria-live="polite"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-ink">
            <Award size={19} strokeWidth={2} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">Niveau {levelUp.index} atteint</p>
            <p className="text-[12px] text-mist">
              {levelUp.name} · continue, ta liberté se construit.
            </p>
          </div>
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-mist hover:bg-veil hover:text-snow"
            onClick={() => setLevelUp(null)}
            aria-label="Fermer la célébration"
          >
            <X size={17} strokeWidth={1.75} />
          </button>
        </div>
      ) : null}
    </>
  );
}

export function DebtBossCard({
  bosses,
  currency,
}: {
  bosses: DebtBoss[];
  currency: string;
}) {
  if (bosses.length === 0) return null;

  const active = bosses.filter((boss) => !boss.cleared);
  if (active.length === 0) {
    return (
      <section className="card p-5 sm:p-6" aria-labelledby="debt-boss-title">
        <p className="label">Boss de la liberté</p>
        <h2 id="debt-boss-title" className="mt-1 text-[22px]">
          Tous tes boss sont vaincus
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-mist">
          Tes dettes sont soldées. La marge que tu libères peut maintenant travailler pour toi.
        </p>
      </section>
    );
  }

  const boss = active.find((item) => item.isNext) ?? active[0];
  const progress = boss.progress;
  const remaining = Math.max(0, boss.balance);

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="debt-boss-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label">Boss de la liberté</p>
          <h2 id="debt-boss-title" className="mt-1 text-[22px]">
            {boss.title}
          </h2>
          <p className="mt-1 text-[13px] text-mist">
            {formatAmount(remaining, currency)} {currencyLabel(currency)} restants
            {boss.months != null ? ` · ${boss.months} mois estimés` : ' · mensualité à définir'}
          </p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-coral/10 text-coral-text">
          <Target size={19} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </div>

      <div className="mt-4">
        <ProgressBar
          value={progress}
          height={12}
          tone="danger"
          ariaLabel={`Progression de remboursement de ${boss.title}`}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-mist">
          <span>{Math.round(progress * 100)} % vaincu</span>
          <span>
            {boss.repaid > 0
              ? `${formatAmount(boss.repaid, currency)} déjà remboursés`
              : 'Premier coup à porter'}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-mist">
          {active.length} boss actif{active.length > 1 ? 's' : ''} · priorité au taux le plus élevé
        </p>
        <Link to="/epargner" className="btn btn-secondary h-11 text-[13px]">
          Attaquer
          <ArrowRight size={15} strokeWidth={2} />
        </Link>
      </div>
    </section>
  );
}
