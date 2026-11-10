import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'libre-theme';
const COLORS: Record<Theme, string> = { dark: '#0B0F15', light: '#EEF1F5' };

const listeners = new Set<() => void>();
let current: Theme | null = null;

function readStored(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** Le mode nuit est l'identité de Libre : c'est le défaut, pas une préférence système. */
export function getTheme(): Theme {
  if (current) return current;
  current = readStored() ?? 'dark';
  return current;
}

export function applyTheme(theme: Theme) {
  current = theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', COLORS[theme]);
  listeners.forEach((listener) => listener());
}

export function setTheme(theme: Theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // navigation privée : la préférence ne sera pas conservée
  }
  applyTheme(theme);
}

export function useTheme() {
  const [theme, setLocal] = useState<Theme>(getTheme);

  useEffect(() => {
    const sync = () => setLocal(getTheme());
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);

  // Un autre onglet a changé de thème : on suit.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) applyTheme(readStored() ?? 'dark');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback(() => {
    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, setTheme, toggle };
}
