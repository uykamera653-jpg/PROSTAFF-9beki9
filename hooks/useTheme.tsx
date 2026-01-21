import { useMemo } from 'react';
import { colors } from '../constants/theme';
import { useSettings } from './useSettings';

export function useTheme() {
  const { darkMode } = useSettings();
  
  const theme = useMemo(() => {
    return darkMode ? colors.dark : colors.light;
  }, [darkMode]);

  return { theme, isDark: darkMode };
}
