import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Logo } from './components/ui';
import { useAuth } from './lib/auth';
import { useRecurringTransactions, useWorkspace } from './lib/queries';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import Save from './pages/Save';
import Invest from './pages/Invest';
import Freedom from './pages/Freedom';
import Tips from './pages/Tips';
import Settings from './pages/Settings';
import Admin from './pages/Admin';

function Splash({ label = 'On prépare ton espace…' }: { label?: string }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-5">
      <Logo size={30} />
      <div className="h-1 w-24 overflow-hidden rounded-full bg-line">
        <div className="h-full w-1/2 animate-[shimmer_1.2s_linear_infinite] rounded-full bg-accent" />
      </div>
      <p className="text-sm text-mist">{label}</p>
    </div>
  );
}

function useGuardedWorkspace() {
  const { session, loading } = useAuth();
  const query = useWorkspace(session?.user.id);
  useRecurringTransactions(session?.user.id);
  return { session, loading, ...query };
}

function Protected() {
  const { session, loading, data, isLoading, error } = useGuardedWorkspace();
  const location = useLocation();

  if (loading) return <Splash />;
  if (!session) return <Navigate to="/connexion" replace />;
  if (isLoading) return <Splash />;

  if (error) {
    return (
      <div className="container-app flex min-h-[70dvh] flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-2xl">Impossible de charger tes données</h1>
        <p className="max-w-sm text-sm text-mist">
          Vérifie ta connexion internet, puis recharge la page. Tes données restent en sécurité sur
          ton compte.
        </p>
        <button
          type="button"
          className="btn btn-primary mt-2"
          onClick={() => window.location.reload()}
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (
    data &&
    !data.profile.onboarded &&
    location.pathname !== '/bienvenue' &&
    !(location.pathname === '/admin' && data.profile.is_admin)
  ) {
    return <Navigate to="/bienvenue" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function OnboardingGate() {
  const { session, loading, data, isLoading } = useGuardedWorkspace();

  if (loading || (session && isLoading)) return <Splash />;
  if (!session) return <Navigate to="/connexion" replace />;
  if (data?.profile.onboarded) return <Navigate to="/" replace />;
  return <Onboarding profile={data?.profile} />;
}

function Root() {
  const { session, loading } = useAuth();
  if (loading) return <Splash />;
  if (!session) return <Navigate to="/connexion" replace />;
  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/connexion" element={<Auth />} />
        <Route path="/bienvenue" element={<OnboardingGate />} />
        <Route element={<Protected />}>
          <Route path="/" element={<Home />} />
          <Route path="/epargner" element={<Save />} />
          <Route path="/investir" element={<Invest />} />
          <Route path="/liberte" element={<Freedom />} />
          <Route path="/conseils" element={<Tips />} />
          <Route path="/parametres" element={<Settings />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<Root />} />
      </Routes>
    </BrowserRouter>
  );
}

