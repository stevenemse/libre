import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ArrowRight, Check, Mail } from 'lucide-react';
import { Logo, Alert, FieldError, cn } from '../components/ui';
import { useAuth } from '../lib/auth';
import { supabaseConfigured } from '../lib/supabase';

type Mode = 'signin' | 'signup' | 'magic';

const IDEAS = [
  "Devenir riche, c'est être libre : choisir sa vie sans dépendre d'un salaire.",
  'Épargne = revenus − besoins courants. Le reste, tu le choisis.',
  'Investis dans trois directions : subsistance, assets, protection.',
];

export default function Auth() {
  const { session, signIn, signUp, signInWithMagicLink } = useAuth();
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'magic') {
        await signInWithMagicLink(email.trim());
        setNotice('Lien envoyé. Ouvre ta boîte mail et clique sur le lien pour entrer.');
      } else if (mode === 'signup') {
        if (!adult) throw new Error('Libre est réservé aux personnes de 18 ans et plus.');
        if (!firstName.trim()) throw new Error('Dis-nous ton prénom.');
        if (password.length < 6) throw new Error('Choisis un mot de passe de 6 caractères minimum.');
        const { needsConfirm } = await signUp(email.trim(), password, firstName.trim());
        if (needsConfirm) {
          setNotice('Compte créé. Confirme ton adresse e-mail, puis connecte-toi.');
        }
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="container-app grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-16">
        <section className="fade-up">
          <Logo size={26} />
          <h1 className="mt-8 max-w-[15ch] text-[38px] font-semibold leading-[1.05] sm:text-[52px]">
            Richesse<span className="text-accent-text"> =</span> liberté.
          </h1>
          <p className="mt-4 max-w-[46ch] text-[16px] leading-relaxed text-mist">
            Libre t'aide à suivre ton argent, épargner sans te priver et construire des revenus qui
            travaillent pour toi. Pas de promesse magique : des chiffres clairs et un cap.
          </p>

          <ul className="mt-8 space-y-3">
            {IDEAS.map((idea) => (
              <li key={idea} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-text">
                  <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                </span>
                <span className="max-w-[52ch] text-[14px] leading-relaxed text-mist">{idea}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 grid max-w-md grid-cols-2 gap-3">
            <div className="card-flat p-4">
              <p className="text-[26px] font-semibold leading-none text-accent-text">4 %</p>
              <p className="mt-1.5 text-[13px] leading-snug text-mist">
                La règle qui transforme un capital en revenu mensuel.
              </p>
            </div>
            <div className="card-flat p-4">
              <p className="text-[26px] font-semibold leading-none">6 mois</p>
              <p className="mt-1.5 text-[13px] leading-snug text-mist">
                De besoins couverts : ton coussin de sécurité.
              </p>
            </div>
          </div>
        </section>

        <section className="card fade-up w-full max-w-[480px] justify-self-center p-6 sm:p-8">
          <div className="grid grid-cols-2 gap-1 rounded-full bg-slate2 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
                setNotice(null);
              }}
              aria-pressed={mode === 'signup'}
              className={cn(
                'h-11 rounded-full text-[15px] font-semibold transition-colors',
                mode === 'signup' ? 'bg-accent text-ink' : 'text-mist hover:text-snow'
              )}
            >
              Créer un compte
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
                setNotice(null);
              }}
              aria-pressed={mode === 'signin'}
              className={cn(
                'h-11 rounded-full text-[15px] font-semibold transition-colors',
                mode === 'signin' ? 'bg-accent text-ink' : 'text-mist hover:text-snow'
              )}
            >
              Se connecter
            </button>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {mode === 'signup' ? (
              <div>
                <label htmlFor="first-name" className="field-label">
                  Prénom
                </label>
                <input
                  id="first-name"
                  className="field"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="Ex. Awa"
                  maxLength={40}
                />
              </div>
            ) : null}

            <div>
              <label htmlFor="email" className="field-label">
                Adresse e-mail
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                className="field"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="toi@exemple.com"
                required
              />
            </div>

            {mode !== 'magic' ? (
              <div>
                <label htmlFor="password" className="field-label">
                  Mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="field"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="6 caractères minimum"
                  required
                />
              </div>
            ) : null}

            {mode === 'signup' ? (
              <label className="flex items-start gap-3 rounded-2xl bg-slate2/60 p-3 text-[13px] leading-relaxed text-mist">
                <input
                  id="adult"
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                  checked={adult}
                  onChange={(event) => setAdult(event.target.checked)}
                />
                <span>
                  J'ai 18 ans ou plus et j'accepte que Libre conserve mes données pour calculer mon
                  épargne. Libre est un outil pédagogique, pas un conseil financier personnalisé.
                </span>
              </label>
            ) : null}

            {error ? <Alert tone="danger" title={error} /> : null}
            {notice ? <Alert tone="info" title={notice} /> : null}

            <button type="submit" className="btn btn-primary w-full" disabled={busy}>
              {busy
                ? 'Un instant…'
                : mode === 'signup'
                  ? 'Créer mon compte'
                  : mode === 'signin'
                    ? 'Entrer'
                    : 'Recevoir mon lien'}
              <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'magic' ? 'signin' : 'magic');
                setError(null);
                setNotice(null);
              }}
              className="flex min-h-11 w-full items-center justify-center gap-2 py-2 text-[14px] font-medium text-mist transition-colors hover:text-snow"
            >
              <Mail size={14} strokeWidth={1.75} aria-hidden="true" />
              {mode === 'magic' ? 'Utiliser un mot de passe' : 'Recevoir un lien magique par e-mail'}
            </button>
          </form>

          <p className="mt-6 text-[12px] leading-relaxed text-mist">
            Libre est réservé aux 18 ans et plus. Tu peux exporter ou supprimer tes données à tout
            moment, et aucune donnée financière n'est vendue.
          </p>

          {!supabaseConfigured ? (
            <div className="mt-4">
              <FieldError>
                Supabase n'est pas configuré : renseigne les variables VITE_SUPABASE_URL et
                VITE_SUPABASE_PUBLISHABLE_KEY.
              </FieldError>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
