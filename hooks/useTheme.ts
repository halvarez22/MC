import { useCallback, useEffect, useState } from 'react';
import {
  applyTheme,
  getStoredTheme,
  type ThemeMode,
} from '../services/themeService';

/**
 * Preferencia de tema del usuario (claro / oscuro).
 * El apply va SOLO en useEffect: en StrictMode el updater de setState
 * se invoca 2 veces y si hace side-effects el tema “rebota” a oscuro.
 */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() =>
    typeof document !== 'undefined' ? getStoredTheme() : 'light'
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setTheme(mode);
  }, []);

  return { theme, isDark: theme === 'dark', toggleTheme, setThemeMode };
}
