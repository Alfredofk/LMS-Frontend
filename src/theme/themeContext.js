import { createContext } from 'react';

/*
  Light or dark — the signed-in app's appearance.

  Stored like the language (`lms_lang`): in localStorage, never in the session
  store the tokens use. It is a preference of this machine, not of a sign-in.

  **No stored value means "follow the device".** A fresh visitor on a phone set
  to dark mode gets dark; the first time they flip the switch on Settings, their
  choice is stored and the device stops deciding. Owner's decision, 2026-09-24.

  Split across three files — this one, ThemeProvider.jsx and useTheme.js — so
  the component file exports only a component, which is what Vite's fast
  refresh needs (the lint rule behind LanguageContext's standing error).
*/
export const THEME_KEY = 'lms_theme';

export const readStoredTheme = () => {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
  } catch {
    return null;
  }
};

export const deviceQuery = () =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

export const ThemeContext = createContext(null);
