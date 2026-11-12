import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { cn } from './ui';
import type { TourStep } from '../lib/tourSteps';

interface Props {
  open: boolean;
  steps: TourStep[];
  onDone: () => void;
}

const isVisible = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const firstVisible = (selector: string): HTMLElement | null => {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return nodes.find(isVisible) ?? null;
};

/**
 * Visite guidée : découpe un halo autour de l'élément visé, affiche une carte
 * explicative et navigue d'écran en écran. Sur mobile, la carte se pose en bas
 * au-dessus de la barre de navigation ; sur ordinateur, elle suit l'élément.
 */
export function Tour({ open, steps, onDone }: Props) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardHeight, setCardHeight] = useState(220);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const step = steps[index];
  const last = index === steps.length - 1;

  const finish = useCallback(() => {
    onDone();
  }, [onDone]);

  const next = useCallback(() => {
    if (index >= steps.length - 1) {
      onDone();
      return;
    }
    setIndex(index + 1);
  }, [index, steps.length, onDone]);

  const previous = useCallback(() => {
    setIndex((value) => Math.max(0, value - 1));
  }, []);

  // Repartir de la première étape à chaque ouverture.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  // Aller sur le bon écran puis repérer la cible (elle peut arriver après le rendu).
  useEffect(() => {
    if (!open) return;
    const current = steps[index];
    if (current.route) navigate(current.route);

    let cancelled = false;
    let attempts = 0;
    let timer = 0;

    const locate = () => {
      if (cancelled) return;
      if (!current.target) {
        setRect(null);
        return;
      }
      const element = firstVisible(current.target);
      if (!element) {
        attempts += 1;
        if (attempts > 25) {
          setRect(null);
          return;
        }
        timer = window.setTimeout(locate, 80);
        return;
      }
      element.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    };

    timer = window.setTimeout(locate, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, index, steps, navigate]);

  // Suivre l'élément image par image : le halo reste aligné même si la page
  // défile, se redimensionne, ou si le contenu arrive juste après la navigation.
  useEffect(() => {
    if (!open) return;
    const selector = steps[index]?.target;
    if (!selector) {
      setRect(null);
      return;
    }
    let previousKey = '';
    const measure = () => {
      const element = firstVisible(selector);
      if (!element) return;
      const next = element.getBoundingClientRect();
      const key = `${Math.round(next.top)}:${Math.round(next.left)}:${Math.round(next.width)}:${Math.round(next.height)}`;
      if (key !== previousKey) {
        previousKey = key;
        setRect(next);
      }
    };
    measure();
    const interval = window.setInterval(measure, 120);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open, index, steps]);

  // Blocage du défilement de la page derrière.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Clavier : Échap quitte, flèches et Entrée naviguent.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish();
      } else if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault();
        next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previous();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, finish, next, previous]);

  useEffect(() => {
    if (!open) return;
    cardRef.current?.focus();
  }, [open, index]);

  // Mesurer la carte pour la placer sans jamais la couper.
  useLayoutEffect(() => {
    if (!open || !cardRef.current) return;
    const height = cardRef.current.offsetHeight;
    setCardHeight((value) => (Math.abs(value - height) > 4 ? height : value));
  }, [open, index, cardHeight, step?.body]);

  if (!open || !step) return null;

  const mobile = window.innerWidth < 640;
  const width = Math.min(380, window.innerWidth - 32);
  let cardStyle: CSSProperties;

  if (rect && !mobile) {
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 16);
    const below = rect.bottom + 14;
    const fitsBelow = window.innerHeight - below - 16 >= cardHeight;
    const top = fitsBelow ? below : Math.max(16, rect.top - cardHeight - 14);
    cardStyle = { top, left, width };
  } else if (rect && mobile) {
    // Par défaut la carte se pose au-dessus de la barre de navigation. Si elle
    // recouvre l'élément visé (le bouton d'ajout, par exemple), on la remonte
    // en haut de l'écran pour laisser l'élément visible.
    const bottomTop = window.innerHeight - 84 - cardHeight;
    const hides = (top: number) => rect.bottom > top - 8 && rect.top < top + cardHeight + 8;
    const moveToTop = hides(bottomTop) && !hides(16);
    cardStyle = moveToTop
      ? { left: 16, right: 16, top: 16 }
      : { left: 16, right: 16, bottom: 'calc(84px + env(safe-area-inset-bottom))' };
  } else {
    cardStyle = mobile
      ? { left: 16, right: 16, bottom: 'calc(84px + env(safe-area-inset-bottom))' }
      : { left: '50%', top: '50%', width, transform: 'translate(-50%, -50%)' };
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[75]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
    >
      {/* Bloque les clics sur la page sans assombrir deux fois */}
      <div className="absolute inset-0" aria-hidden="true" onClick={(event) => event.stopPropagation()} />

      {rect ? (
        <div
          className="pointer-events-none absolute rounded-[22px] border-2 border-accent"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(11, 15, 21, 0.82)',
          }}
          aria-hidden="true"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(11, 15, 21, 0.84)' }}
          aria-hidden="true"
        />
      )}

      <div
        ref={cardRef}
        tabIndex={-1}
        className="absolute rounded-[26px] border border-line bg-slate1 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] focus:outline-none"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="label">
            Étape {index + 1} sur {steps.length}
          </p>
          <button
            type="button"
            onClick={finish}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate2 text-mist transition-colors hover:text-snow"
            aria-label="Passer le guide"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        <h2 id="tour-title" className="mt-1 text-[20px] leading-tight">
          {step.title}
        </h2>
        <p id="tour-body" className="mt-2 text-[14px] leading-relaxed text-mist">
          {step.body}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {/* Sur téléphone, le compteur « Étape n sur N » suffit : douze pastilles
              ne tenaient pas à côté des boutons et débordaient de la carte. */}
          <div
            className="hidden items-center gap-1.5 sm:flex"
            role="group"
            aria-label="Progression du guide"
          >
            {steps.map((item, dotIndex) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(dotIndex)}
                aria-label={`Aller à l'étape ${dotIndex + 1}`}
                aria-current={dotIndex === index}
                className="flex h-6 w-5 items-center justify-center rounded-full"
              >
                <span
                  className={cn(
                    'block h-1.5 rounded-full transition-all',
                    dotIndex === index ? 'w-5 bg-accent' : 'w-1.5 bg-line-strong hover:bg-mist/60'
                  )}
                />
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {index > 0 ? (
              <button type="button" className="btn btn-ghost h-11 px-3 text-[13px]" onClick={previous}>
                <ArrowLeft size={15} strokeWidth={2} />
                Retour
              </button>
            ) : null}
            <button type="button" className="btn btn-primary h-11 px-4 text-[13px]" onClick={next}>
              {last ? 'Terminer' : 'Suivant'}
              <ArrowRight size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
