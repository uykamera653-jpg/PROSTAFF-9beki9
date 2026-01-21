import React, { createContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language } from '../constants/translations';
import { AppSettings } from '../types';

interface SettingsContextType {
  language: Language;
  darkMode: boolean;
  setLanguage: (lang: Language) => Promise<void>;
  setDarkMode: (enabled: boolean) => Promise<void>;
  isLoading: boolean;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('uz');
  const [darkMode, setDarkModeState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settingsJson = await AsyncStorage.getItem('app_settings');
      if (settingsJson) {
        const settings: AppSettings = JSON.parse(settingsJson);
        setLanguageState(settings.language);
        setDarkModeState(settings.darkMode);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setLanguage = async (lang: Language) => {
    try {
      setLanguageState(lang);
      const settings: AppSettings = { language: lang, darkMode };
      await AsyncStorage.setItem('app_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save language:', error);
    }
  };

  const setDarkMode = async (enabled: boolean) => {
    try {
      setDarkModeState(enabled);
      const settings: AppSettings = { language, darkMode: enabled };
      await AsyncStorage.setItem('app_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save dark mode:', error);
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        language,
        darkMode,
        setLanguage,
        setDarkMode,
        isLoading,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
