import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && key);

if (!supabaseConfigured) {
  console.error(
    'Supabase non configuré : renseigne VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY dans .env'
  );
}

// Clé publiable uniquement : la sécurité des données est assurée par la RLS.
export const supabase = createClient(url ?? 'http://localhost', key ?? 'public-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
