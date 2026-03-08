import { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'vb-theme';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return (localStorage.getItem(STORAGE_KEY) as Theme) ?? 'dark';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    applyTheme(getInitialTheme());
  }, []);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

const CHART_COLORS = {
  light: { axis: '#807c90', muted: '#706c80', card: '#ffffff', border: '#e4e0ed' },
  dark:  { axis: '#8a86a0', muted: '#8a86a0', card: '#12121a', border: '#1e1e2e' },
} as const;

export function useChartColors() {
  const { theme } = useTheme();
  return CHART_COLORS[theme];
}
