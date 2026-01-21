import { useMemo } from 'react';
import { translations } from '../constants/translations';
import { useSettings } from './useSettings';

export function useTranslation() {
  const { language } = useSettings();
  
  const t = useMemo(() => {
    return translations[language];
  }, [language]);

  return { t, language };
}
