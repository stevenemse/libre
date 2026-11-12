import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  hasError: boolean;
}

/**
 * Dernier filet de sécurité : une erreur de rendu ne doit jamais laisser un
 * écran blanc. Les données restent sur le compte, rien n'est supprimé.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur de rendu Libre', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="app-shell">
        <div className="container-app flex min-h-[70dvh] flex-col items-center justify-center gap-3 text-center">
          <h1 className="text-2xl">Cet écran n'a pas pu s'afficher</h1>
          <p className="max-w-sm text-[15px] leading-relaxed text-mist">
            Aucune de tes données n'est perdue : tout reste enregistré sur ton compte. Recharge
            l'écran pour reprendre.
          </p>
          <button
            type="button"
            className="btn btn-primary mt-2"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
          >
            Recharger
          </button>
        </div>
      </div>
    );
  }
}
