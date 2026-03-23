import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface AppConfig {
  id: string;
  key: string;
  value: any;
  description?: string;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AppConfigContextType {
  configs: AppConfig[];
  isLoading: boolean;
  getConfig: (key: string, defaultValue?: any) => any;
  refreshConfigs: () => Promise<void>;
}

export const AppConfigContext = createContext<AppConfigContextType | undefined>(undefined);

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [configs, setConfigs] = useState<AppConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    loadConfigs();
    setupRealtimeSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const loadConfigs = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('app_config')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true });

      if (error) {
        console.error('❌ Failed to load app configs:', error);
        setConfigs([]);
        return;
      }

      console.log('✅ App configs loaded:', data?.length || 0);
      setConfigs(data || []);
    } catch (error) {
      console.error('❌ Load configs exception:', error);
      setConfigs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    console.log('📡 Setting up app_config real-time subscription');
    
    channelRef.current = supabase
      .channel('app_config_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_config',
        },
        (payload) => {
          console.log('📨 App config changed:', payload);
          // Reload all configs when any change occurs
          loadConfigs();
        }
      )
      .subscribe((status) => {
        console.log('📡 App config subscription status:', status);
      });
  };

  const getConfig = (key: string, defaultValue: any = null): any => {
    const config = configs.find(c => c.key === key && c.is_active);
    return config ? config.value : defaultValue;
  };

  const refreshConfigs = async () => {
    await loadConfigs();
  };

  return (
    <AppConfigContext.Provider
      value={{
        configs,
        isLoading,
        getConfig,
        refreshConfigs,
      }}
    >
      {children}
    </AppConfigContext.Provider>
  );
}
