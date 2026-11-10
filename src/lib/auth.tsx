import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthValue {
  session: Session | null;
  userId: string | undefined;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, firstName: string) => Promise<{ needsConfirm: boolean }>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const message = (error: { message: string } | null): string => {
  if (!error) return '';
  const raw = error.message.toLowerCase();
  if (raw.includes('invalid login credentials')) return 'E-mail ou mot de passe incorrect.';
  if (raw.includes('already registered') || raw.includes('already been registered'))
    return 'Ce compte existe déjà. Connecte-toi.';
  if (raw.includes('password should be at least')) return 'Le mot de passe doit faire au moins 6 caractères.';
  if (raw.includes('unable to validate email') || raw.includes('invalid email'))
    return "Cette adresse e-mail n'est pas valide.";
  if (raw.includes('rate limit')) return 'Trop de tentatives. Réessaie dans quelques minutes.';
  if (raw.includes('email not confirmed'))
    return 'Confirme ton e-mail avant de te connecter, ou demande un nouveau lien.';
  return error.message;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(message(error));
  }, []);

  const signUp = useCallback(async (email: string, password: string, firstName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw new Error(message(error));
    return { needsConfirm: !data.session };
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) throw new Error(message(error));
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      session,
      userId: session?.user.id,
      loading,
      signIn,
      signUp,
      signInWithMagicLink,
      signOut,
    }),
    [session, loading, signIn, signUp, signInWithMagicLink, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return context;
}
