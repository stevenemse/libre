import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, TriangleAlert, Info, CheckCircle2, type LucideIcon } from 'lucide-react';
import { currencyLabel, formatAmount } from '../lib/format';

export const cn = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ Logo */
export function Logo({ size = 22, onPaper = false }: { size?: number; onPaper?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2" aria-label="Libre">
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="10" fill="#A8FF00" />
      </svg>
      <span
        style={{ fontSize: size, letterSpacing: '-0.03em' }}
        className={cn('font-extrabold leading-none', onPaper ? 'text-graphite' : 'text-snow')}
      >
        Libre
      </span>
    </span>
  );
}

/* -------------------------------------------------------------- Progress */
export function ProgressBar({
  value,
  height = 10,
  tone = 'accent',
  label,
  ariaLabel,
}: {
  value: number;
  height?: number;
  tone?: 'accent' | 'paper' | 'danger' | 'muted';
  label?: string;
  ariaLabel?: string;
}) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const fill =
    tone === 'danger'
      ? 'bg-coral'
      : tone === 'muted'
        ? 'bg-subsistence'
        : tone === 'paper'
          ? 'bg-graphite'
          : 'bg-accent';
  return (
    <div className="w-full">
      <div
        className="w-full overflow-hidden rounded-full"
        style={{ height, background: 'rgba(255,255,255,0.08)' }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct * 100)}
        aria-label={ariaLabel ?? label ?? 'Progression'}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500 ease-out', fill)}
          style={{ width: `${Math.max(pct * 100, pct > 0 ? 3 : 0)}%` }}
        />
      </div>
      {label ? <p className="label mt-2">{label}</p> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- Money */
export function Amount({
  value,
  currency,
  className,
  unitClassName,
  compact = false,
}: {
  value: number;
  currency: string;
  className?: string;
  unitClassName?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn('num inline-flex items-baseline gap-1.5', className)}>
      <span>{formatAmount(value, currency)}</span>
      {!compact ? (
        <span className={cn('text-[0.5em] font-medium text-mist', unitClassName)}>
          {currencyLabel(currency)}
        </span>
      ) : null}
    </span>
  );
}

/* ----------------------------------------------------------------- Sheet */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="sheet-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-[22px] leading-tight">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-sm text-mist">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate2 text-mist transition-colors hover:text-snow"
            aria-label="Fermer"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        {children}
        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

/* ---------------------------------------------------------------- Toggle */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[15px] font-medium">
          {label}
        </label>
        {description ? <p className="label mt-0.5">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-7 w-12 shrink-0 rounded-full border transition-colors',
          checked ? 'border-accent bg-accent' : 'border-white/10 bg-slate2',
          disabled && 'opacity-40'
        )}
      >
        <span
          className={cn(
            'absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all',
            checked ? 'left-6 bg-ink' : 'left-1 bg-mist'
          )}
        />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ Validation */
export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="mt-1.5 text-[13px] text-coral" role="alert">
      {children}
    </p>
  );
}

export function Alert({
  tone = 'danger',
  title,
  children,
}: {
  tone?: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  children?: ReactNode;
}) {
  const map = {
    danger: { color: 'var(--color-coral)', Icon: TriangleAlert },
    warning: { color: 'var(--color-amber)', Icon: TriangleAlert },
    info: { color: 'var(--color-sky)', Icon: Info },
    success: { color: 'var(--color-accent)', Icon: CheckCircle2 },
  }[tone];
  const Icon = map.Icon;
  return (
    <div
      className="flex gap-3 rounded-2xl border p-4"
      style={{
        borderColor: `color-mix(in srgb, ${map.color} 55%, transparent)`,
        background: `color-mix(in srgb, ${map.color} 12%, transparent)`,
      }}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <Icon size={18} strokeWidth={1.75} style={{ color: map.color }} className="mt-0.5 shrink-0" />
      <div>
        <p className="text-[14px] font-semibold">{title}</p>
        {children ? <div className="mt-1 text-[13px] leading-relaxed text-mist">{children}</div> : null}
      </div>
    </div>
  );
}

export function CoachNote({
  tone,
  title,
  children,
}: {
  tone: 'danger' | 'warning' | 'neutral' | 'positive';
  title: string;
  children: ReactNode;
}) {
  const color =
    tone === 'danger'
      ? 'var(--color-coral)'
      : tone === 'warning'
        ? 'var(--color-amber)'
        : tone === 'positive'
          ? 'var(--color-accent)'
          : 'rgba(255,255,255,0.35)';
  return (
    <div className="border-l-[3px] pl-4" style={{ borderColor: color }}>
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="mt-1 text-[14px] leading-relaxed text-mist">{children}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ Misc */
export function IconCircle({
  icon: Icon,
  size = 40,
  tone = 'default',
}: {
  icon: LucideIcon;
  size?: number;
  tone?: 'default' | 'accent' | 'paper';
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        tone === 'accent' ? 'bg-accent text-ink' : tone === 'paper' ? 'bg-slate2 text-graphite' : 'bg-slate2 text-snow'
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Icon size={size * 0.45} strokeWidth={1.75} />
    </span>
  );
}

export function Avatar({ label, size = 36 }: { label: string; size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-full bg-accent font-bold text-ink"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-[22px] leading-tight">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 px-6 py-10 text-center">
      <IconCircle icon={Icon} size={44} />
      <p className="mt-3 text-[15px] font-semibold">{title}</p>
      {children ? <p className="mt-1 max-w-sm text-sm text-mist">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 pt-6" aria-busy="true" aria-label="Chargement">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-44 w-full rounded-[28px]" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-[28px]" />
        <Skeleton className="h-28 rounded-[28px]" />
        <Skeleton className="h-28 rounded-[28px]" />
      </div>
      <Skeleton className="h-52 w-full rounded-[28px]" />
    </div>
  );
}
