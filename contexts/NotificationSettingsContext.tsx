import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export interface NotificationSettings {
  enabled: boolean;
  new_orders: boolean;
  order_updates: boolean;
  messages: boolean;
  sound: boolean;
  vibration: boolean;
  volume: number; // 0.0 - 1.0
}

const defaultSettings: NotificationSettings = {
  enabled: true,
  new_orders: true,
  order_updates: true,
  messages: true,
  sound: true,
  vibration: true,
  volume: 1.0,
};

interface NotificationSettingsContextType {
  settings: NotificationSettings;
  loading: boolean;
  updateSettings: (updates: Partial<NotificationSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

export const NotificationSettingsContext = createContext<NotificationSettingsContextType | undefined>(undefined);

export function NotificationSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSettings();
    } else {
      // Reset to defaults when logged out
      setSettings(defaultSettings);
      setLoading(false);
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('notification_settings')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('❌ Failed to load notification settings:', error);
        throw error;
      }

      if (data?.notification_settings) {
        // Merge with defaults to handle missing keys
        setSettings({ ...defaultSettings, ...data.notification_settings });
      } else {
        setSettings(defaultSettings);
      }
    } catch (error: any) {
      console.error('❌ Error loading notification settings:', error);
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<NotificationSettings>) => {
    if (!user?.id) {
      console.warn('⚠️ No user ID, cannot update settings');
      return;
    }

    try {
      const newSettings = { ...settings, ...updates };
      
      // Optimistic update
      setSettings(newSettings);

      const { error } = await supabase
        .from('user_profiles')
        .update({ notification_settings: newSettings })
        .eq('id', user.id);

      if (error) {
        console.error('❌ Failed to update notification settings:', error);
        // Revert on error
        setSettings(settings);
        throw error;
      }

      console.log('✅ Notification settings updated:', newSettings);
    } catch (error: any) {
      console.error('❌ Error updating notification settings:', error);
      throw error;
    }
  };

  const refreshSettings = async () => {
    await loadSettings();
  };

  return (
    <NotificationSettingsContext.Provider
      value={{
        settings,
        loading,
        updateSettings,
        refreshSettings,
      }}
    >
      {children}
    </NotificationSettingsContext.Provider>
  );
}
