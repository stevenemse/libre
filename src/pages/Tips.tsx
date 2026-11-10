import { useMemo, useState } from 'react';
import { BookOpen, Bookmark, Check, Search } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useSaveTipProgress, useWorkspace } from '../lib/queries';
import { EmptyState, Sheet, cn } from '../components/ui';
import type { Tip, TipCategory } from '../lib/types';

const CATEGORIES: Array<TipCategory | 'Tout'> = [
  'Tout',
  'Épargner',
  'Investir',
  'Protéger',
  'Mentalité',
];

const LEVELS = ['Tous les niveaux', 'Débutant', 'Intermédiaire', 'Avancé'] as const;

export default function Tips() {
  const { userId } = useAuth();
  const { data } = useWorkspace(userId);
  const saveProgress = useSaveTipProgress(userId);

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Tout');
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('Tous les niveaux');
  const [query, setQuery] = useState('');
  const [openTip, setOpenTip] = useState<Tip | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const progressMap = useMemo(
    () => new Map(data?.progress.map((row) => [row.tip_id, row]) ?? []),
    [data?.progress]
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = query.trim().toLowerCase();
    return data.tips.filter((tip) => {
      if (category !== 'Tout' && tip.category !== category) return false;
      if (level !== 'Tous les niveaux' && tip.level !== level) return false;
      if (onlyFavorites && !progressMap.get(tip.id)?.favorite) return false;
      if (!term) return true;
      return `${tip.title} ${tip.body}`.toLowerCase().includes(term);
    });
  }, [data, category, level, query, onlyFavorites, progressMap]);

  if (!data) return null;

  const readCount = data.progress.filter((row) => row.read_at).length;
  const favoriteCount = data.progress.filter((row) => row.favorite).length;

  const openTipDetail = (tip: Tip) => {
    setOpenTip(tip);
    if (!progressMap.get(tip.id)?.read_at) {
      saveProgress.mutate({ tipId: tip.id, read: true });
    }
  };

  return (
    <div className="fade-up space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Conseils</p>
          <h1 className="mt-1 text-[30px] leading-tight sm:text-[38px]">Apprends en 2 minutes</h1>
        </div>
        <p className="text-[13px] text-mist">
          {readCount} lu{readCount > 1 ? 's' : ''} sur {data.tips.length} · {favoriteCount} favori
          {favoriteCount > 1 ? 's' : ''}
        </p>
      </header>

      <section className="card-paper overflow-hidden">
        <div className="border-b border-graphite/10 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-1 flex-wrap gap-1.5" role="tablist" aria-label="Catégories de conseils">
              {CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={category === item}
                  className="pill pill-paper shrink-0"
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="pill pill-paper shrink-0"
              aria-pressed={onlyFavorites}
              onClick={() => setOnlyFavorites(!onlyFavorites)}
            >
              <Bookmark size={14} strokeWidth={1.75} />
              Favoris
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                size={16}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-graphite/50"
                aria-hidden="true"
              />
              <input
                className="h-11 w-full rounded-full border border-graphite/10 bg-white pl-10 pr-4 text-[14px] text-graphite placeholder:text-graphite/40 focus:border-graphite/30 focus:outline-none"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un conseil"
                aria-label="Rechercher un conseil"
              />
            </div>
            <label className="sr-only" htmlFor="level-filter">
              Niveau
            </label>
            <select
              id="level-filter"
              className="h-11 rounded-full border border-graphite/10 bg-white px-4 text-[14px] text-graphite focus:outline-none"
              value={level}
              onChange={(event) => setLevel(event.target.value as (typeof LEVELS)[number])}
            >
              {LEVELS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={BookOpen} title="Aucun conseil ne correspond">
              Essaie un autre mot, ou retire les filtres.
            </EmptyState>
          </div>
        ) : (
          <ul className="divide-y divide-graphite/10">
            {filtered.map((tip) => {
              const progress = progressMap.get(tip.id);
              return (
                <li key={tip.id}>
                  <button
                    type="button"
                    onClick={() => openTipDetail(tip)}
                    className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-graphite/[0.03] sm:px-5"
                  >
                    <span className="mt-0.5 hidden shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-ink sm:inline-block">
                      {tip.category}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-semibold text-graphite">
                          {tip.title}
                        </span>
                        {progress?.read_at ? (
                          <Check size={14} strokeWidth={2.5} className="shrink-0 text-graphite/40" aria-label="Lu" />
                        ) : null}
                        {progress?.favorite ? (
                          <Bookmark
                            size={13}
                            strokeWidth={2}
                            className="shrink-0 fill-graphite text-graphite"
                            aria-label="Favori"
                          />
                        ) : null}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-[13px] leading-relaxed text-graphite/65">
                        {tip.body}
                      </span>
                      <span className="mt-1 block text-[11px] font-medium text-graphite/45 sm:hidden">
                        {tip.category} · {tip.level}
                      </span>
                    </span>
                    <span className="mt-0.5 hidden shrink-0 text-[11px] text-graphite/45 sm:block">
                      {tip.level}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Sheet
        open={Boolean(openTip)}
        onClose={() => setOpenTip(null)}
        title={openTip?.title ?? ''}
        subtitle={openTip ? `${openTip.category} · ${openTip.level}` : undefined}
      >
        {openTip ? (
          <div>
            <span className="inline-block rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-ink">
              {openTip.category}
            </span>
            <p className="mt-4 max-w-[70ch] text-[15px] leading-relaxed text-snow/90">{openTip.body}</p>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className={cn('btn flex-1', progressMap.get(openTip.id)?.favorite ? 'btn-primary' : 'btn-secondary')}
                onClick={() =>
                  saveProgress.mutate({
                    tipId: openTip.id,
                    favorite: !progressMap.get(openTip.id)?.favorite,
                    read: true,
                  })
                }
              >
                <Bookmark
                  size={16}
                  strokeWidth={1.75}
                  className={progressMap.get(openTip.id)?.favorite ? 'fill-ink' : ''}
                />
                {progressMap.get(openTip.id)?.favorite ? 'Dans tes favoris' : 'Ajouter aux favoris'}
              </button>
            </div>

            <p className="mt-4 text-[11px] leading-relaxed text-mist">
              Conseil pédagogique. Libre ne donne pas de conseil financier personnalisé.
            </p>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
