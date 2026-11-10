const CURRENCY_LABEL: Record<string, string> = {
  XAF: 'FCFA',
  XOF: 'FCFA',
  EUR: '€',
  USD: '$',
  GBP: '£',
  CAD: '$ CA',
  CHF: 'CHF',
  MAD: 'DH',
  NGN: '₦',
  GHS: 'GH₵',
  KES: 'KSh',
  ZAR: 'R',
};

const ZERO_DECIMAL = new Set(['XAF', 'XOF', 'NGN', 'KES', 'GHS', 'MAD', 'ZAR']);

export const currencyLabel = (currency = 'XAF'): string =>
  CURRENCY_LABEL[currency] ?? currency;

export function formatAmount(amount: number, currency = 'XAF'): string {
  const fractionDigits = ZERO_DECIMAL.has(currency) ? 0 : 2;
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(Math.round(amount * 100) / 100);
}

export function formatMoney(amount: number, currency = 'XAF'): string {
  return `${formatAmount(amount, currency)} ${currencyLabel(currency)}`;
}

export function formatCompact(amount: number, currency = 'XAF'): string {
  const label = currencyLabel(currency);
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1).replace('.0', '')} Md ${label}`;
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.0', '')} M ${label}`;
  if (abs >= 10_000) return `${Math.round(amount / 1000)} k ${label}`;
  return formatMoney(amount, currency);
}

export const formatPercent = (ratio: number, digits = 0): string =>
  new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(ratio) ? ratio : 0);

export const formatDate = (iso: string): string =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export const formatDay = (iso: string): string =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export const todayISO = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
};

export const initials = (name: string | null | undefined): string => {
  const clean = (name ?? '').trim();
  if (!clean) return 'L';
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
};
