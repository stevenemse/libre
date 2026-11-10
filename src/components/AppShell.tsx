import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Compass,
  House,
  PiggyBank,
  Plus,
  Settings,
  TrendingUp,
  WifiOff,
} from 'lucide-react';
import { Logo, Avatar, cn } from './ui';
import { useAuth } from '../lib/auth';
import { useOnlineStatus, useWorkspace } from '../lib/queries';
import { initials } from '../lib/format';
import { TransactionSheet } from './TransactionSheet';
import type { TxType } from '../lib/types';

const NAV = [
  { to: '/', label: 'Accueil', icon: House },
  { to: '/epargner', label: 'Épargner', icon: PiggyBank },
  { to: '/investir', label: 'Investir', icon: TrendingUp },
  { to: '/liberte', label: 'Ma liberté', icon: Compass },
  { to: '/conseils', label: 'Conseils', icon: BookOpen },
];

interface TxSheetValue {
  open: (type?: TxType) => void;
}

const TxSheetContext = createContext<TxSheetValue | null>(null);

export function useTxSheet(): TxSheetValue {
  const context = useContext(TxSheetContext);
  if (!context) throw new Error('useTxSheet doit être utilisé dans AppShell');
  return context;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { userId, session } = useAuth();
  const { data: workspace } = useWorkspace(userId);
  const { online, pending } = useOnlineStatus();
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetType, setSheetType] = useState<TxType>('expense');

  const openSheet = useCallback((type: TxType = 'expense') => {
    setSheetType(type);
    setSheetOpen(true);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  const currency = workspace?.profile.currency ?? 'XAF';
  const firstName = workspace?.profile.first_name ?? '';
  const emailName = session?.user.email?.split('@')[0] ?? '';

  return (
    <TxSheetContext.Provider value={{ open: openSheet }}>
      <div className="app-shell">
        <a href="#contenu" className="sr-only-focusable btn btn-primary fixed left-4 top-4 z-50">
          Aller au contenu
        </a>

        <header className="sticky top-0 z-40 border-b border-white/5 bg-night/85 backdrop-blur-xl">
          <div className="container-app flex h-16 items-center justify-between gap-3">
            <Link to="/" className="shrink-0" aria-label="Libre, accueil">
              <Logo size={21} />
            </Link>

            <nav className="nav-pill hidden lg:flex" aria-label="Navigation principale">
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                  <item.icon size={15} strokeWidth={1.75} aria-hidden="true" />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => openSheet('expense')}
                className="btn btn-primary hidden h-10 px-4 text-sm sm:inline-flex"
              >
                <Plus size={16} strokeWidth={2} aria-hidden="true" />
                Ajouter
              </button>
              <NavLink
                to="/parametres"
                className="flex h-10 w-10 items-center justify-center rounded-full text-mist transition-colors hover:bg-white/5 hover:text-snow"
                aria-label="Paramètres"
              >
                <Settings size={18} strokeWidth={1.75} />
              </NavLink>
              <Link to="/parametres" aria-label="Mon profil" className="hidden sm:block">
                <Avatar label={initials(firstName || emailName)} />
              </Link>
            </div>
          </div>
        </header>

        {!online || pending > 0 ? (
          <div className="border-b border-white/5 bg-slate1/70">
            <div className="container-app flex items-center gap-2 py-2 text-[13px] text-mist">
              <WifiOff size={14} strokeWidth={1.75} aria-hidden="true" />
              {!online
                ? 'Hors-ligne — tes saisies sont gardées et partiront au retour du réseau.'
                : `${pending} transaction${pending > 1 ? 's' : ''} en attente d'envoi…`}
            </div>
          </div>
        ) : null}

        <main id="contenu" className="container-app flex-1 pb-28 pt-5 md:pt-7 lg:pb-14">
          {children}
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-night/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
          aria-label="Navigation principale"
        >
          <div className="mx-auto flex max-w-md items-stretch justify-between px-2 py-2">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium transition-colors',
                    isActive ? 'text-accent' : 'text-mist hover:text-snow'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={20} strokeWidth={isActive ? 2.2 : 1.75} aria-hidden="true" />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        <button
          type="button"
          onClick={() => openSheet('expense')}
          className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-ink shadow-[0_8px_28px_rgba(168,255,0,0.22)] transition-transform active:scale-95 lg:hidden"
          aria-label="Ajouter une transaction"
        >
          <Plus size={24} strokeWidth={2.2} />
        </button>

        <TransactionSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          userId={userId}
          currency={currency}
          initialType={sheetType}
        />
      </div>
    </TxSheetContext.Provider>
  );
}
