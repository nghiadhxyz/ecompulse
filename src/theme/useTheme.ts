/** Workspace colour theme: light by default, dark as an option (top-bar toggle). Per browser. */
import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'ecompulse-theme';

function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(readTheme);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage blocked: the choice lasts for this session */
    }
  }, [theme]);
  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  return [theme, setTheme];
}
