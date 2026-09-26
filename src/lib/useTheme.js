import { useEffect, useLayoutEffect, useState } from 'react';

const STORAGE_KEY = 'sementics-theme';
const lightQuery = () => window.matchMedia('(prefers-color-scheme: light)');

// Follows the OS until the user picks a theme; the pick is remembered per machine.
// Applied as <html data-theme>, which swaps the color tokens in index.css.
export default function useTheme() {
  const [picked, setPicked] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [system, setSystem] = useState(() => (lightQuery().matches ? 'light' : 'dark'));

  useEffect(() => {
    const query = lightQuery();
    const onChange = () => setSystem(query.matches ? 'light' : 'dark');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const theme = picked === 'light' || picked === 'dark' ? picked : system;

  // Layout effect so the first paint already uses the right theme.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setPicked(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisted; the choice still applies for this session.
    }
  };

  return [theme, toggle];
}
