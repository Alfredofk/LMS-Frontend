import { useContext } from 'react';

import { ThemeContext } from './themeContext';

/** @returns {{ isDark: boolean, followsDevice: boolean, setDark: (dark: boolean) => void }} */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

export default useTheme;
