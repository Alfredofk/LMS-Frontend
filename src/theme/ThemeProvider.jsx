import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { THEME_KEY, ThemeContext, deviceQuery, readStoredTheme } from './themeContext';

/*
  Holds the choice; does not paint anything.

  Painting is MainLayout's job — it puts `data-theme` on <html> while the
  signed-in shell is mounted and takes it off on the way out — because the
  owner scoped dark mode to the signed-in app (2026-09-24): the landing page and
  the purple sign-in screens keep their own colours. On <html> rather than on a
  wrapper div, so dialogs rendered through a portal into <body> go dark too.
*/
export const ThemeProvider = ({ children }) => {
  const [stored, setStored] = useState(readStoredTheme);
  const [deviceDark, setDeviceDark] = useState(() => Boolean(deviceQuery()?.matches));

  /* The device can change its mind mid-visit (a sunset schedule); follow it
     for as long as nobody has chosen. */
  useEffect(() => {
    const query = deviceQuery();
    if (!query) return undefined;
    const onChange = (e) => setDeviceDark(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const setDark = useCallback((dark) => {
    const next = dark ? 'dark' : 'light';
    setStored(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Blocked storage: the choice lasts for this visit only.
    }
  }, []);

  const value = useMemo(
    () => ({
      isDark: stored ? stored === 'dark' : deviceDark,
      followsDevice: stored === null,
      setDark,
    }),
    [stored, deviceDark, setDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export default ThemeProvider;
